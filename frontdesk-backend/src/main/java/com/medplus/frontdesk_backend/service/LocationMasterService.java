package com.medplus.frontdesk_backend.service;

import com.medplus.frontdesk_backend.dto.CityMasterDto;
import com.medplus.frontdesk_backend.dto.CompanyMasterDto;
import com.medplus.frontdesk_backend.dto.CreateCityRequestDto;
import com.medplus.frontdesk_backend.dto.CreateCompanyRequestDto;
import com.medplus.frontdesk_backend.dto.CreateLocationRequestDto;
import com.medplus.frontdesk_backend.dto.CreateLocationTypeRequestDto;
import com.medplus.frontdesk_backend.dto.CreateStateRequestDto;
import com.medplus.frontdesk_backend.dto.LocationListFilterDto;
import com.medplus.frontdesk_backend.dto.LocationMasterDto;
import com.medplus.frontdesk_backend.dto.LocationTypeMasterDto;
import com.medplus.frontdesk_backend.dto.PagedResponseDto;
import com.medplus.frontdesk_backend.dto.StateMasterDto;
import com.medplus.frontdesk_backend.repository.LocationMasterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.function.Predicate;

@Service
@RequiredArgsConstructor
public class LocationMasterService {

    private static final int COMPANY_CODE_MAX_LEN = 20;
    private static final int COMPANY_ID_PREFIX_LEN = 3;
    private static final int LOCATION_TYPE_CODE_MAX_LEN = 20;

    private final LocationMasterRepository repository;

    // ── companies ─────────────────────────────────────────────────────────────

    public List<CompanyMasterDto> listCompanies(boolean activeOnly) {
        return repository.findAllCompanies(activeOnly);
    }

    public CompanyMasterDto createCompany(CreateCompanyRequestDto req, String actor) {
        String name = req.getCompanyName().trim();
        if (repository.companyNameExists(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Company already exists.");
        }
        String code = generateUniqueCode(name, COMPANY_CODE_MAX_LEN, repository::companyCodeExists);
        long id = repository.insertCompany(code, name, actor);
        return repository.findCompanyById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load company."));
    }

    public void updateCompanyStatus(long id, boolean active, String actor) {
        repository.findCompanyById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found."));
        repository.updateCompanyStatus(id, active, actor);
    }

    // ── location types ────────────────────────────────────────────────────────

    public List<LocationTypeMasterDto> listLocationTypes(boolean activeOnly) {
        return repository.findAllLocationTypes(activeOnly);
    }

    public LocationTypeMasterDto createLocationType(CreateLocationTypeRequestDto req, String actor) {
        String name = req.getTypeName().trim();
        if (repository.locationTypeNameExists(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Location type already exists.");
        }
        String code = generateUniqueCode(name, LOCATION_TYPE_CODE_MAX_LEN, repository::locationTypeCodeExists);
        long id = repository.insertLocationType(code, name, actor);
        return repository.findLocationTypeById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load location type."));
    }

    public void updateLocationTypeStatus(long id, boolean active, String actor) {
        repository.findLocationTypeById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location type not found."));
        repository.updateLocationTypeStatus(id, active, actor);
    }

    // ── states & cities ───────────────────────────────────────────────────────

    public List<StateMasterDto> listStates(boolean activeOnly) {
        return repository.findAllStates(activeOnly);
    }

    public StateMasterDto createState(CreateStateRequestDto req, String actor) {
        String code = normalizeUpper(req.getStateCode());
        if (repository.stateCodeExists(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "State code already exists.");
        }
        repository.insertState(code, req.getStateName().trim(), actor);
        return repository.findStateByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load state."));
    }

    public List<CityMasterDto> listCities(String stateCode, boolean activeOnly) {
        if (stateCode == null || stateCode.isBlank()) {
            return repository.findAllCities(activeOnly);
        }
        return repository.findCitiesByState(normalizeUpper(stateCode), activeOnly);
    }

    public CityMasterDto createCity(CreateCityRequestDto req, String actor) {
        String stateCode = normalizeUpper(req.getStateCode());
        String cityCode = normalizeUpper(req.getCityCode());
        repository.findStateByCode(stateCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "State not found."));
        if (repository.cityCodeExists(stateCode, cityCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "City code already exists for this state.");
        }
        repository.insertCity(cityCode, req.getCityName().trim(), stateCode, actor);
        return repository.findCity(stateCode, cityCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load city."));
    }

    // ── locations ─────────────────────────────────────────────────────────────

    public PagedResponseDto<LocationMasterDto> listLocations(LocationListFilterDto filters, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int offset = Math.max(0, page) * safeSize;
        long total = repository.countLocations(filters);
        List<LocationMasterDto> content = repository.findLocations(filters, offset, safeSize);
        return PagedResponseDto.of(content, page, safeSize, total);
    }

    public LocationMasterDto createLocation(CreateLocationRequestDto req, String actor) {
        ResolvedGeo state = resolveStateInput(req.getState());
        ResolvedGeo city  = resolveCityInput(req.getCity());
        String address    = req.getAddress().trim();

        CompanyMasterDto company = repository.findCompanyById(req.getCompanyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company not found."));
        if (!company.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company is inactive.");
        }

        LocationTypeMasterDto locType = repository.findLocationTypeById(req.getLocationTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location type not found."));
        if (!locType.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location type is inactive.");
        }

        ensureStateExists(state, actor);
        ensureCityExists(state.code(), city, actor);

        String idPrefix = buildLocationIdPrefix(company.getCompanyName(), locType.getTypeName());
        int sequence = repository.nextSequenceForIdPrefix(idPrefix);
        if (sequence > 99999) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Maximum locations reached for this company and office type.");
        }

        String locationId = idPrefix + String.format("%05d", sequence);
        String descriptiveName = buildLocationName(company.getCompanyName(), locType.getTypeName(), address);

        repository.insertLocation(
                locationId,
                req.getCompanyId(),
                req.getLocationTypeId(),
                state.code(),
                city.code(),
                address,
                descriptiveName,
                sequence,
                actor
        );

        return repository.findLocationById(locationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load location."));
    }

    public void updateLocationStatus(String locationId, boolean active, String actor) {
        repository.findLocationById(locationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found."));
        repository.updateLocationStatus(locationId, active, actor);
    }

    public String previewNextLocationId(long companyId, long locationTypeId) {
        CompanyMasterDto company = repository.findCompanyById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company not found."));
        LocationTypeMasterDto locType = repository.findLocationTypeById(locationTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location type not found."));
        String idPrefix = buildLocationIdPrefix(company.getCompanyName(), locType.getTypeName());
        int sequence = repository.nextSequenceForIdPrefix(idPrefix);
        return idPrefix + String.format("%05d", sequence);
    }

    static String buildLocationIdPrefix(String companyName, String officeTypeName) {
        return deriveCompanyIdPrefix(companyName) + "-" + deriveOfficeTypeIdPrefix(officeTypeName) + "-";
    }

    static String deriveCompanyIdPrefix(String companyName) {
        String letters = extractLetters(companyName);
        if (letters.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Company name must contain at least 2 letters.");
        }
        if (letters.length() >= COMPANY_ID_PREFIX_LEN) {
            return letters.substring(0, COMPANY_ID_PREFIX_LEN);
        }
        return String.format("%-" + COMPANY_ID_PREFIX_LEN + "s", letters).replace(' ', 'X');
    }

    static String deriveOfficeTypeIdPrefix(String officeTypeName) {
        String trimmed = officeTypeName == null ? "" : officeTypeName.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Office type is required.");
        }
        String[] words = trimmed.split("\\s+");
        StringBuilder initials = new StringBuilder();
        for (String word : words) {
            for (int i = 0; i < word.length(); i++) {
                char ch = word.charAt(i);
                if (Character.isLetter(ch)) {
                    initials.append(Character.toUpperCase(ch));
                    break;
                }
            }
        }
        if (initials.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Office type must contain at least one letter.");
        }
        return initials.toString();
    }

    private static String extractLetters(String value) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (Character.isLetter(ch)) {
                out.append(Character.toUpperCase(ch));
            }
        }
        return out.toString();
    }

    private void ensureStateExists(ResolvedGeo state, String actor) {
        if (repository.findStateByCode(state.code()).isPresent()) {
            return;
        }
        repository.insertState(state.code(), state.displayName(), actor);
    }

    private void ensureCityExists(String stateCode, ResolvedGeo city, String actor) {
        if (repository.cityCodeExists(stateCode, city.code())) {
            return;
        }
        repository.insertCity(city.code(), city.displayName(), stateCode, actor);
    }

    static String buildLocationName(String companyName, String officeTypeName, String address) {
        return companyName + " - " + officeTypeName + " - " + address;
    }

    private static ResolvedGeo resolveStateInput(String input) {
        String trimmed = input == null ? "" : input.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "State is required.");
        }
        if (trimmed.length() == 2 && trimmed.matches("[A-Za-z]{2}")) {
            String code = trimmed.toUpperCase();
            return new ResolvedGeo(code, code);
        }
        String code = deriveCode(trimmed, 2);
        return new ResolvedGeo(code, trimmed);
    }

    private static ResolvedGeo resolveCityInput(String input) {
        String trimmed = input == null ? "" : input.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "City is required.");
        }
        if (trimmed.length() == 3 && trimmed.matches("[A-Za-z]{3}")) {
            String code = trimmed.toUpperCase();
            return new ResolvedGeo(code, code);
        }
        String code = deriveCode(trimmed, 3);
        return new ResolvedGeo(code, trimmed);
    }

    private static String deriveCode(String name, int length) {
        String letters = name.replaceAll("[^A-Za-z]", "").toUpperCase();
        if (letters.length() >= length) {
            return letters.substring(0, length);
        }
        if (letters.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    length == 2 ? "State must contain at least 2 letters." : "City must contain at least 3 letters.");
        }
        return String.format("%-" + length + "s", letters).replace(' ', 'X').substring(0, length);
    }

    private static String normalizeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }

    static String generateUniqueCode(String name, int maxLen, Predicate<String> codeExists) {
        String base = deriveCodeBase(name, maxLen);
        if (!codeExists.test(base)) {
            return base;
        }
        for (int suffix = 2; suffix < 10_000; suffix++) {
            String suffixText = String.valueOf(suffix);
            int prefixLen = Math.max(1, maxLen - suffixText.length());
            String candidate = base.substring(0, Math.min(base.length(), prefixLen)) + suffixText;
            if (!codeExists.test(candidate)) {
                return candidate;
            }
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Could not generate a unique code. Try a different name.");
    }

    private static String deriveCodeBase(String name, int maxLen) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required.");
        }

        String[] words = trimmed.split("\\s+");
        StringBuilder base = new StringBuilder();
        if (words.length > 1) {
            for (String word : words) {
                for (int i = 0; i < word.length(); i++) {
                    char ch = word.charAt(i);
                    if (Character.isLetterOrDigit(ch)) {
                        base.append(Character.toUpperCase(ch));
                        break;
                    }
                }
            }
        } else {
            for (int i = 0; i < trimmed.length(); i++) {
                char ch = trimmed.charAt(i);
                if (Character.isLetterOrDigit(ch)) {
                    base.append(Character.toUpperCase(ch));
                }
            }
        }

        if (base.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name must contain at least 2 letters or numbers.");
        }
        return base.substring(0, Math.min(base.length(), maxLen));
    }

    private record ResolvedGeo(String code, String displayName) {}
}
