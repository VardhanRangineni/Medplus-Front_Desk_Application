package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PreRegFormDataDto {
    private String locationId;
    private String locationName;
    private List<PersonOption> persons;
    private List<String> departments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PersonOption {
        private String id;
        private String name;
        private String department;
    }
}
