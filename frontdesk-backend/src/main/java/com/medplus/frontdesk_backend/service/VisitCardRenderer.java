package com.medplus.frontdesk_backend.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Renders branded visit-card PNGs matching the web self-registration card layout.
 */
@Service
public class VisitCardRenderer {

    private static final int W = 420;
    private static final int H = 640;

    private static final Color BRAND = Color.decode("#c2181d");
    private static final Color BRAND_DARK = Color.decode("#9e1418");
    private static final Color BRAND_LIGHT = Color.decode("#b9151a");
    private static final Color BRAND_END = Color.decode("#d42a2f");
    private static final Color TEXT = Color.decode("#0f172a");
    private static final Color TEXT_MUTED = Color.decode("#64748b");
    private static final Color BG = Color.decode("#e8ecf2");

    private static final Font FONT_UI = new Font(Font.SANS_SERIF, Font.PLAIN, 13);
    private static final Font FONT_BADGE = new Font(Font.SANS_SERIF, Font.BOLD, 11);
    private static final Font FONT_TITLE = new Font(Font.SANS_SERIF, Font.BOLD, 30);
    private static final Font FONT_SUBTITLE = new Font(Font.SANS_SERIF, Font.PLAIN, 13);
    private static final Font FONT_LABEL = new Font(Font.SANS_SERIF, Font.BOLD, 11);
    private static final Font FONT_NAME = new Font(Font.SANS_SERIF, Font.BOLD, 22);
    private static final Font FONT_REF = new Font(Font.MONOSPACED, Font.PLAIN, 12);
    private static final Font FONT_HINT = new Font(Font.SANS_SERIF, Font.PLAIN, 13);
    private static final Font FONT_FOOTER = new Font(Font.SANS_SERIF, Font.BOLD, 11);

    public byte[] renderPng(String visitorName, String token) {
        BufferedImage canvas = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = canvas.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            g.setColor(BG);
            g.fillRect(0, 0, W, H);

            int cardX = 20;
            int cardY = 20;
            int cardW = W - 40;
            int cardH = H - 40;

            g.setColor(Color.WHITE);
            fillRoundRect(g, cardX, cardY, cardW, cardH, 18);

            int headerH = 108;
            Shape clip = new RoundRectangle2D.Float(cardX, cardY, cardW, cardH, 18, 18);
            g.setClip(clip);
            GradientPaint grad = new GradientPaint(
                    cardX, cardY, BRAND_LIGHT,
                    cardX + cardW, cardY + headerH, BRAND_END);
            g.setPaint(grad);
            g.fillRect(cardX, cardY, cardW, headerH);

            drawBadge(g, "MVMS · RECEPTION CHECK-IN", cardX + 24, cardY + 22);

            g.setFont(FONT_TITLE);
            g.setColor(Color.WHITE);
            g.drawString("MedPlus", cardX + 24, cardY + 78);

            g.setFont(FONT_SUBTITLE);
            g.setColor(new Color(255, 255, 255, 235));
            g.drawString("Visitor Pass", cardX + 24, cardY + 98);
            g.setClip(null);

            int qrSize = 220;
            int qrX = cardX + (cardW - qrSize) / 2;
            int qrY = cardY + headerH + 36;

            g.setColor(Color.decode("#f8fafc"));
            fillRoundRect(g, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 14);
            g.setColor(Color.decode("#e2e8f0"));
            g.setStroke(new BasicStroke(2f));
            drawRoundRect(g, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 14);

            BufferedImage qr = generateQr("PREREG:" + token, qrSize);
            g.drawImage(qr, qrX, qrY, qrSize, qrSize, null);

            String displayName = visitorName != null && !visitorName.isBlank() ? visitorName.trim() : "Visitor";
            String shortRef = token != null && token.length() >= 8
                    ? token.substring(0, 8).toUpperCase()
                    : (token != null ? token.toUpperCase() : "");

            int y = qrY + qrSize + 44;
            g.setFont(FONT_LABEL);
            g.setColor(TEXT_MUTED);
            drawCentered(g, "VISITOR", cardX + cardW / 2, y);

            y += 28;
            g.setFont(FONT_NAME);
            g.setColor(TEXT);
            List<String> nameLines = wrapText(g, displayName, cardW - 48);
            for (int i = 0; i < Math.min(2, nameLines.size()); i++) {
                drawCentered(g, nameLines.get(i), cardX + cardW / 2, y);
                y += 28;
            }

            y += 8;
            int refW = Math.min(cardW - 48, 280);
            int refX = cardX + (cardW - refW) / 2;
            g.setColor(Color.decode("#f1f5f9"));
            fillRoundRect(g, refX, y - 18, refW, 36, 8);
            g.setFont(FONT_REF);
            g.setColor(TEXT_MUTED);
            drawCentered(g, "Ref · " + shortRef, cardX + cardW / 2, y + 6);

            y += 52;
            g.setFont(FONT_HINT);
            g.setColor(TEXT_MUTED);
            for (String line : wrapText(g, "Show this card at MedPlus reception when you arrive.", cardW - 56)) {
                drawCentered(g, line, cardX + cardW / 2, y);
                y += 20;
            }

            g.setColor(BRAND);
            g.setStroke(new BasicStroke(3f));
            g.drawLine(cardX + 48, cardY + cardH - 28, cardX + cardW - 48, cardY + cardH - 28);
            g.setFont(FONT_FOOTER);
            g.setColor(BRAND_DARK);
            drawCentered(g, "SCAN AT RECEPTION", cardX + cardW / 2, cardY + cardH - 10);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            javax.imageio.ImageIO.write(canvas, "png", out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to render visit card: " + ex.getMessage(), ex);
        } finally {
            g.dispose();
        }
    }

    private static BufferedImage generateQr(String payload, int size) throws Exception {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix matrix = new QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, size, size, hints);
        return MatrixToImageWriter.toBufferedImage(matrix);
    }

    private static void drawBadge(Graphics2D g, String text, int x, int y) {
        g.setFont(FONT_BADGE);
        FontMetrics fm = g.getFontMetrics();
        int padX = 12;
        int h = 24;
        int w = fm.stringWidth(text) + padX * 2;
        g.setColor(new Color(255, 255, 255, 46));
        fillRoundRect(g, x, y, w, h, h / 2);
        g.setColor(Color.WHITE);
        g.drawString(text, x + padX, y + h / 2 + fm.getAscent() / 2 - 2);
    }

    private static void fillRoundRect(Graphics2D g, int x, int y, int w, int h, int arc) {
        g.fill(new RoundRectangle2D.Float(x, y, w, h, arc, arc));
    }

    private static void drawRoundRect(Graphics2D g, int x, int y, int w, int h, int arc) {
        g.draw(new RoundRectangle2D.Float(x, y, w, h, arc, arc));
    }

    private static void drawCentered(Graphics2D g, String text, int centerX, int baselineY) {
        FontMetrics fm = g.getFontMetrics();
        int x = centerX - fm.stringWidth(text) / 2;
        g.drawString(text, x, baselineY);
    }

    private static List<String> wrapText(Graphics2D g, String text, int maxWidth) {
        List<String> lines = new ArrayList<>();
        String[] words = text.split("\\s+");
        StringBuilder line = new StringBuilder();
        FontMetrics fm = g.getFontMetrics();
        for (String word : words) {
            String test = line.isEmpty() ? word : line + " " + word;
            if (fm.stringWidth(test) > maxWidth && !line.isEmpty()) {
                lines.add(line.toString());
                line = new StringBuilder(word);
            } else {
                line = new StringBuilder(test);
            }
        }
        if (!line.isEmpty()) {
            lines.add(line.toString());
        }
        return lines;
    }
}
