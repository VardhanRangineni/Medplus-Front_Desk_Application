package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Generic paginated response envelope.
 *
 * @param <T> the type of each item in the page
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagedResponseDto<T> {

    /** The records in the current page. */
    private List<T> content;

    /** 0-based current page index. */
    private int  page;

    /** Number of records requested per page. */
    private int  size;

    /** Total number of matching records across all pages. */
    private long totalElements;

    /** Total number of pages ( ceil(totalElements / size) ). */
    private int  totalPages;

    /** True when this is the first page. */
    private boolean first;

    /** True when this is the last page. */
    private boolean last;

    /** Convenience factory so callers don't need the builder boilerplate. */
    public static <T> PagedResponseDto<T> of(List<T> content, int page, int size, long totalElements) {
        int totalPages = size > 0 ? (int) Math.ceil((double) totalElements / size) : 0;
        return PagedResponseDto.<T>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .first(page == 0)
                .last(page >= totalPages - 1)
                .build();
    }
}
