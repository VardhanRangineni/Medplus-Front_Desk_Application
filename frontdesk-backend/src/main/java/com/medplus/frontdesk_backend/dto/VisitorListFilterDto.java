package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Optional column filters for paginated visitor list / search. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisitorListFilterDto {

    /** VISITOR or EMPLOYEE */
    private String entryType;
    private String name;
    private String contactQuery;
    private String personToMeet;
    private String cardNumber;

    public static VisitorListFilterDto of(String entryType, String name, String contactQuery,
                                          String personToMeet, String cardNumber) {
        return VisitorListFilterDto.builder()
                .entryType(blankToNull(entryType))
                .name(blankToNull(name))
                .contactQuery(blankToNull(contactQuery))
                .personToMeet(blankToNull(personToMeet))
                .cardNumber(blankToNull(cardNumber))
                .build();
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
