package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisitorMemberDto {

    private String  id;
    private String  name;
    private Integer card;
    /** "checked-in" or "checked-out" */
    private String  status;
}
