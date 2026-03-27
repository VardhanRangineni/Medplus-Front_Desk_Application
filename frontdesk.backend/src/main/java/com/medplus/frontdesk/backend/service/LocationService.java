package com.medplus.frontdesk.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.medplus.frontdesk.backend.dto.location.BulkUploadResultDto;
import com.medplus.frontdesk.backend.dto.location.CreateLocationDto;
import com.medplus.frontdesk.backend.dto.location.LocationDto;
import com.medplus.frontdesk.backend.dto.location.LocationPageDto;
import com.medplus.frontdesk.backend.dto.location.UpdateLocationDto;
import com.medplus.frontdesk.backend.exceptions.LocationNotFoundException;
import com.medplus.frontdesk.backend.repository.LocationRepository;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;

    private static final String[] REPORT_HEADERS = {
        "Location ID", "Descriptive Name", "Type", "Coordinates",
        "Address", "City", "State", "Pincode", "Status",
        "Created By", "Modified By", "Created At", "Modified At"
    };

    // ── Fetch (paginated) ─────────────────────────────────────────────────────

    /**
     * Returns a paginated, optionally filtered list of all locations.
     *
     * @param search   substring matched on descriptiveName / id / city / state
     * @param status   ALL | CONFIGURED | NOTCONFIGURED
     * @param page     0-based page index
     * @param pageSize rows per page (max 100)
     */
    public LocationPageDto getLocations(String search, String status, int page, int pageSize) {
        int safeSize   = Math.max(1, Math.min(pageSize, 100));
        int safePage   = Math.max(0, page);
        int offset     = safePage * safeSize;

        int total = locationRepository.countAll(search, status);
        List<LocationDto> rows = locationRepository.findAll(search, status, offset, safeSize);
        int totalPages = total == 0 ? 1 : (int) Math.ceil((double) total / safeSize);

        return new LocationPageDto(rows, safePage, safeSize, total, totalPages);
    }

    // ── Add single location ───────────────────────────────────────────────────

    /**
     * Generates a unique location ID from type, name, and city, then inserts the location.
     */
    public LocationDto addLocation(String createdBy, CreateLocationDto dto) {
        String locationId = generateLocationId(dto.getType(), dto.getDescriptiveName(), dto.getCity());
        locationRepository.insert(createdBy, locationId, dto);
        return locationRepository.findById(locationId);
    }

    // ── Edit location ─────────────────────────────────────────────────────────

    /**
     * Updates all mutable fields of an existing location.
     * The {@code locationId} itself (primary key) cannot be changed.
     *
     * @throws LocationNotFoundException when no location exists with the given ID.
     */
    public LocationDto updateLocation(String locationId, String modifiedBy, UpdateLocationDto dto) {
        if (!locationRepository.existsById(locationId)) {
            throw new LocationNotFoundException(locationId);
        }
        locationRepository.update(locationId, modifiedBy, dto);
        return locationRepository.findById(locationId);
    }

    // ── Bulk upload ───────────────────────────────────────────────────────────

    /**
     * Parses an .xlsx file and inserts each data row as a location.
     * Location IDs are auto-generated; they are not read from the file.
     *
     * Expected column order (row 1 = header, row 2+ = data):
     *   A: Descriptive Name | B: Type | C: Coordinates (optional)
     *   D: Address | E: City | F: State | G: Pincode | H: Status
     */
    public BulkUploadResultDto bulkUpload(String createdBy, MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty.");
        }

        List<String> errors  = new ArrayList<>();
        int success = 0;
        int failed  = 0;
        int dataRows = 0;

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);

            // Row 0 is the header — start from row 1
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                dataRows++;
                int rowNum = i + 1; // 1-based for human-readable error messages

                try {
                    CreateLocationDto dto = parseRow(row, rowNum);

                    String locationId = generateLocationId(
                            dto.getType(), dto.getDescriptiveName(), dto.getCity());
                    locationRepository.insert(createdBy, locationId, dto);
                    success++;

                } catch (IllegalArgumentException e) {
                    errors.add("Row " + rowNum + ": " + e.getMessage());
                    failed++;
                } catch (Exception e) {
                    log.error("Bulk upload – unexpected error on row {}", rowNum, e);
                    errors.add("Row " + rowNum + ": Unexpected error — " + e.getMessage());
                    failed++;
                }
            }
        }

        return new BulkUploadResultDto(dataRows, success, failed, errors);
    }

    // ── Download report ───────────────────────────────────────────────────────

    /**
     * Writes all locations to the HTTP response as an .xlsx file.
     * The response Content-Disposition is set to trigger a browser download.
     */
    public void downloadReport(HttpServletResponse response) throws IOException {
        List<LocationDto> all = locationRepository.findAll(null, null, 0, Integer.MAX_VALUE);

        response.setContentType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"locations-report.xlsx\"");

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Locations");

            // ── Header row ──
            CellStyle headerStyle = buildHeaderStyle(workbook);
            Row headerRow = sheet.createRow(0);
            for (int c = 0; c < REPORT_HEADERS.length; c++) {
                Cell cell = headerRow.createCell(c);
                cell.setCellValue(REPORT_HEADERS[c]);
                cell.setCellStyle(headerStyle);
            }

            // ── Data rows ──
            int rowIdx = 1;
            for (LocationDto loc : all) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(safe(loc.getLocationId()));
                row.createCell(1).setCellValue(safe(loc.getDescriptiveName()));
                row.createCell(2).setCellValue(safe(loc.getType()));
                row.createCell(3).setCellValue(safe(loc.getCoordinates()));
                row.createCell(4).setCellValue(safe(loc.getAddress()));
                row.createCell(5).setCellValue(safe(loc.getCity()));
                row.createCell(6).setCellValue(safe(loc.getState()));
                row.createCell(7).setCellValue(safe(loc.getPincode()));
                row.createCell(8).setCellValue(safe(loc.getStatus()));
                row.createCell(9).setCellValue(safe(loc.getCreatedBy()));
                row.createCell(10).setCellValue(safe(loc.getModifiedBy()));
                row.createCell(11).setCellValue(loc.getCreatedAt() != null
                        ? loc.getCreatedAt().toString() : "");
                row.createCell(12).setCellValue(loc.getModifiedAt() != null
                        ? loc.getModifiedAt().toString() : "");
            }

            // Auto-size columns
            for (int c = 0; c < REPORT_HEADERS.length; c++) {
                sheet.autoSizeColumn(c);
            }

            workbook.write(response.getOutputStream());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Parses one data row from the bulk-upload template.
     *
     * Expected column order (Location ID is no longer a column — it is auto-generated):
     *   A: Descriptive Name | B: Type | C: Coordinates (optional)
     *   D: Address | E: City | F: State | G: Pincode | H: Status
     */
    private CreateLocationDto parseRow(Row row, int rowNum) {
        String descriptiveName = requireCell(row, 0, "Descriptive Name", rowNum);
        String type            = requireCell(row, 1, "Type",             rowNum);
        String coordinates     = cellString(row, 2);   // optional
        String address         = requireCell(row, 3, "Address",          rowNum);
        String city            = requireCell(row, 4, "City",             rowNum);
        String state           = requireCell(row, 5, "State",            rowNum);
        String pincode         = requireCell(row, 6, "Pincode",          rowNum);
        String status          = requireCell(row, 7, "Status",           rowNum);

        if (!"CONFIGURED".equals(status) && !"NOTCONFIGURED".equals(status)) {
            throw new IllegalArgumentException(
                    "Status must be CONFIGURED or NOTCONFIGURED, got '" + status + "'");
        }

        return new CreateLocationDto(
                descriptiveName, type, coordinates,
                address, city, state, pincode, status);
    }

    private String requireCell(Row row, int col, String name, int rowNum) {
        String val = cellString(row, col);
        if (val == null || val.isBlank()) {
            throw new IllegalArgumentException(name + " is required but missing.");
        }
        return val.trim();
    }

    private String cellString(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            // Prevents scientific notation on numeric-looking IDs
            return String.valueOf((long) cell.getNumericCellValue());
        }
        String v = cell.getStringCellValue();
        return v == null || v.isBlank() ? null : v.trim();
    }

    private boolean isRowEmpty(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK
                    && !cell.toString().isBlank()) {
                return false;
            }
        }
        return true;
    }

    private CellStyle buildHeaderStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_RED.getIndex());
        style.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    // ── Location ID generation ────────────────────────────────────────────────

    /**
     * Builds a location ID from the given fields using the pattern:
     *   {TYPE_INITIALS}-{NAME_INITIALS}-{CITY_SHORT}-{SEQUENCE}
     *
     * Examples:
     *   type="Primary Health Center", name="Apollo Main Branch", city="Mumbai"
     *   → "PHC-AMB-MUM-001"
     *
     * The sequence is determined by counting existing IDs with the same prefix
     * and incrementing by one, ensuring uniqueness within each prefix group.
     */
    private String generateLocationId(String type, String descriptiveName, String city) {
        String typeInitials = initials(type);
        String nameInitials = initials(descriptiveName);
        String cityShort    = cityAbbr(city);
        String prefix       = typeInitials + "-" + nameInitials + "-" + cityShort + "-";

        int count = locationRepository.countByIdPrefix(prefix);
        return prefix + String.format("%03d", count + 1);
    }

    /** Returns the uppercase first letter of each word in the given text. */
    private String initials(String text) {
        if (text == null || text.isBlank()) return "X";
        StringBuilder sb = new StringBuilder();
        for (String word : text.trim().split("\\s+")) {
            if (!word.isEmpty()) {
                sb.append(Character.toUpperCase(word.charAt(0)));
            }
        }
        return sb.toString();
    }

    /** Returns the first 3 uppercase letters of the city name. */
    private String cityAbbr(String city) {
        if (city == null || city.isBlank()) return "XXX";
        String upper = city.trim().toUpperCase().replaceAll("\\s+", "");
        return upper.length() >= 3 ? upper.substring(0, 3) : upper;
    }
}
