package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PersonToMeetDto {

    private String id;
    private String name;
    private String phone;
    private String department;
    private String designation;
}
