package com.medplus.frontdesk.backend.dto.visitor;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for a group check-in.
 *
 * The first member ({@code head}) is treated as the group leader.
 * All members receive the head's generated visitor ID in their
 * {@code groupHeadVisitorId} field.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckInGroupDto {

    @Valid
    @NotNull(message = "head visitor is required")
    private CheckInVisitorDto head;

    @Valid
    @NotEmpty(message = "at least one group member is required")
    private List<CheckInVisitorDto> members;
}
