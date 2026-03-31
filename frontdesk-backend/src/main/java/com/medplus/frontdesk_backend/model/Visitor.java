package com.medplus.frontdesk_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Visitor {

    private String        visitorId;
    private VisitType     visitType;
    private EntryType     entryType;
    private String        name;
    private String        mobile;
    private String        empId;
    private VisitStatus   status;
    private String        personToMeet;
    private String        personName;
    private String        department;
    private String        locationId;
    private Integer       cardNumber;
    private GovtIdType    govtIdType;
    private String        govtIdNumber;
    private String        imageUrl;
    private LocalDateTime checkInTime;
    private LocalDateTime checkOutTime;
    private String        reasonForVisit;
    private String        createdBy;
}
