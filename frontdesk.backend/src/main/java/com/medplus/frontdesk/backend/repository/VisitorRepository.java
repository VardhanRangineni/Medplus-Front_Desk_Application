package com.medplus.frontdesk.backend.repository;

import java.util.List;

import com.medplus.frontdesk.backend.dto.visitor.CheckInVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.UpdateVisitorDto;
import com.medplus.frontdesk.backend.dto.visitor.VisitorDto;

public interface VisitorRepository {

    /**
     * Inserts a new visitor record with the provided pre-generated IDs.
     *
     * @param createdBy          username of the receptionist performing check-in
     * @param visitorId          auto-generated visitor ID (e.g. MED-V-001 or MED-GV-002)
     * @param groupHeadVisitorId ID of the group head, or {@code null} for single/group-head rows
     * @param dto                check-in form data
     */
    void insert(String createdBy, String visitorId, String groupHeadVisitorId, CheckInVisitorDto dto);

    /**
     * Updates the editable (global) fields of an existing visitor record.
     *
     * @param visitorId  ID of the visitor to update
     * @param modifiedBy username of the receptionist making the change
     * @param dto        new field values
     * @return {@code true} if a row was updated, {@code false} if the visitor was not found
     */
    boolean update(String visitorId, String modifiedBy, UpdateVisitorDto dto);

    /**
     * Sets {@code status = 'CheckedOut'} and stamps {@code checkOutTime = NOW()} for the
     * given visitor. Only transitions a row that is currently {@code CheckedIn}.
     *
     * @param visitorId  ID of the visitor to check out
     * @param modifiedBy username of the receptionist performing the action
     * @return {@code true} if a row was updated, {@code false} if no matching checked-in row exists
     */
    boolean checkOut(String visitorId, String modifiedBy);

    /** Fetches a single visitor row by ID; returns {@code null} if not found. */
    VisitorDto findById(String visitorId);

    /**
     * Returns a page of visitors filtered by the provided criteria.
     *
     * @param search     substring matched against fullName, identificationNumber,
     *                   govtId, cardNumber, and personToMeet; {@code null} = no filter
     * @param status     {@code "CheckedIn"}, {@code "CheckedOut"}, or {@code "ALL"}
     * @param locationId filter by location; {@code null} = all locations
     * @param offset     number of rows to skip (for pagination)
     * @param limit      maximum rows to return
     */
    List<VisitorDto> findAll(String search, String status, String locationId, int offset, int limit);

    /**
     * Total count matching the same criteria as {@link #findAll} (used for pagination metadata).
     */
    int count(String search, String status, String locationId);

    /**
     * Counts existing visitors whose ID starts with {@code prefix}.
     * Used to determine the next sequence number when generating an ID.
     */
    int countByIdPrefix(String prefix);
}
