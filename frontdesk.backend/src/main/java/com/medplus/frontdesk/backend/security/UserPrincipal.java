package com.medplus.frontdesk.backend.security;

import java.util.Collection;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * Custom principal that enriches the standard Spring Security UserDetails
 * with the user's assigned locationId.
 *
 * Storing the location here means dashboard endpoints can read it directly
 * from the authenticated principal without an extra DB round-trip.
 */
public class UserPrincipal implements UserDetails {

    private final String username;
    private final String password;
    private final String locationId;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(String username, String password, String locationId,
                         Collection<? extends GrantedAuthority> authorities) {
        this.username    = username;
        this.password    = password;
        this.locationId  = locationId;
        this.authorities = authorities;
    }

    public String getLocationId() {
        return locationId;
    }

    @Override public String getUsername()                                             { return username; }
    @Override public String getPassword()                                             { return password; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities()         { return authorities; }
    @Override public boolean isAccountNonExpired()                                    { return true; }
    @Override public boolean isAccountNonLocked()                                     { return true; }
    @Override public boolean isCredentialsNonExpired()                                { return true; }
    @Override public boolean isEnabled()                                              { return true; }
}
