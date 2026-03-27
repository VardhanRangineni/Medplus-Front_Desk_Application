package com.medplus.frontdesk.backend.dto.visitor;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Paginated list of visitors returned by GET /user/visitors. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VisitorPageDto {
    private List<VisitorDto> rows;
    private int page;
    private int pageSize;
    private int totalRows;
    private int totalPages;
}
