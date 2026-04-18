package com.medplus.frontdesk_backend.integration;

/**
 * Thread-local holder for the current request's Zimbra auth context.
 * Populated by ZimbraSessionInterceptor; consumed by services.
 * Always cleared in interceptor.afterCompletion to prevent memory leaks.
 */
public final class ZimbraContext {

    private record ContextData(String authToken, String email) {}

    private static final ThreadLocal<ContextData> HOLDER = new ThreadLocal<>();

    private ZimbraContext() {}

    public static void set(String authToken, String email) {
        HOLDER.set(new ContextData(authToken, email));
    }

    public static String getAuthToken() {
        ContextData data = HOLDER.get();
        if (data == null) throw new IllegalStateException(
                "ZimbraContext not initialised — is ZimbraSessionInterceptor registered?");
        return data.authToken();
    }

    public static String getEmail() {
        ContextData data = HOLDER.get();
        return data != null ? data.email() : "unknown";
    }

    public static void clear() {
        HOLDER.remove();
    }
}
