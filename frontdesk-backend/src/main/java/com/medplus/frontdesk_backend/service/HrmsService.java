package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.client.HrmsApiClient;
import com.medplus.frontdesk_backend.dto.HrmsEmployeeDto;
import com.medplus.frontdesk_backend.dto.HrmsEmployeeLookupDto;
import com.medplus.frontdesk_backend.dto.UserLookupDto;
import com.medplus.frontdesk_backend.exception.ExternalApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class HrmsService {

    private final HrmsApiClient hrmsApiClient;

    public Optional<HrmsEmployeeLookupDto> lookupEmployeeByEmployeeId(String employeeId) {
        return map(hrmsApiClient.fetchByEmployeeId(employeeId));
    }

    public Optional<HrmsEmployeeLookupDto> lookupEmployeeByHrmsId(String hrmsId) {
        return map(hrmsApiClient.fetchByHrmsId(hrmsId));
    }

    public Optional<HrmsEmployeeLookupDto> lookupEmployeeByPhoneNo(String phoneNo) {
        return map(hrmsApiClient.fetchByPhoneNo(phoneNo));
    }

    /** Internal projection for person-to-meet and pre-registration flows. */
    public Optional<UserLookupDto> lookupByEmployeeId(String employeeId) {
        return hrmsApiClient.fetchByEmployeeId(employeeId).map(this::toUserLookup);
    }

    public Optional<UserLookupDto> lookupByHrmsId(String hrmsId) {
        return hrmsApiClient.fetchByHrmsId(hrmsId).map(this::toUserLookup);
    }

    public Optional<UserLookupDto> lookupByPhoneNo(String phoneNo) {
        return hrmsApiClient.fetchByPhoneNo(phoneNo).map(this::toUserLookup);
    }

    private Optional<HrmsEmployeeLookupDto> map(Optional<HrmsEmployeeDto> result) {
        try {
            return result.map(this::toHrmsLookup);
        } catch (ExternalApiException ex) {
            throw ex;
        }
    }

    private HrmsEmployeeLookupDto toHrmsLookup(HrmsEmployeeDto e) {
        return HrmsEmployeeLookupDto.builder()
                .id(trimToNull(e.getEmployeeId()))
                .hrmsId(trimToNull(e.getHrmsId()))
                .name(trimToNull(e.getFullName()))
                .workEmail(trimToNull(e.getWorkEmail()))
                .workPhoneNo(trimToNull(e.getWorkPhoneNo()))
                .personalPhoneNo(trimToNull(e.getPersonalPhoneNo()))
                .phone(trimToNull(e.getPhone()))
                .companyName(trimToNull(e.getCompanyName()))
                .designation(trimToNull(e.getDesignation()))
                .workLocation(trimToNull(e.getWorkLocation()))
                .department(trimToNull(e.getDepartment()))
                .role(trimToNull(e.getRole()))
                .build();
    }

    private UserLookupDto toUserLookup(HrmsEmployeeDto e) {
        return UserLookupDto.builder()
                .id(trimToNull(e.getEmployeeId()))
                .hrmsId(trimToNull(e.getHrmsId()))
                .name(trimToNull(e.getFullName()))
                .location(trimToNull(e.getWorkLocation()))
                .designation(trimToNull(e.getDesignation()))
                .department(trimToNull(e.getDepartment()))
                .email(trimToNull(e.getWorkEmail()))
                .phone(trimToNull(e.getPhone()))
                .build();
    }

    private static String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
