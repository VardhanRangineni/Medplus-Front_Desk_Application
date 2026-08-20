package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupVisitorMemberDto {

    /** Required for VISITOR and EMPLOYEE. */
    private String name;

    /** Required for VISITOR. */
    private String mobile;

    /** Required for EMPLOYEE. */
    private String empId;

    /** Per-member visitor card number (VISITOR). */
    private Integer cardNumber;
}
