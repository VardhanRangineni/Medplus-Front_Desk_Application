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
    /** Auto-assigned card code from cardmaster, e.g. "MSOH-VISITOR-7". Preferred over card if set. */
    private String  cardCode;
    /** "checked-in" or "checked-out" */
    private String  status;
}
