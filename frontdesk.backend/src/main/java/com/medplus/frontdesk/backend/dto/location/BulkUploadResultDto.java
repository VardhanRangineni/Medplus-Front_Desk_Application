package com.medplus.frontdesk.backend.dto.location;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Result of POST /admin/locations/bulk-upload. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BulkUploadResultDto {
    private int totalRows;
    private int successCount;
    private int failedCount;
    /** One entry per failed row: "Row N: <reason>" */
    private List<String> errors;
}
