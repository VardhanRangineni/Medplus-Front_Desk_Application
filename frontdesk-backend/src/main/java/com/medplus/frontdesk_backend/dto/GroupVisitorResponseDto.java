package com.medplus.frontdesk_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupVisitorResponseDto {
    /** e.g. MED-GROUP-0001 */
    private String groupId;
    private List<VisitorResponseDto> members;
}
