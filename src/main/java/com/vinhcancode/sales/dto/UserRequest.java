package com.vinhcancode.sales.dto;

import java.util.List;
import java.util.Map;

public class UserRequest {

    public String username;
    public String password;
    public String fullName;
    public String imageUrl;
    public String role;
    public Boolean active;
    public List<Long> companyIds;
    public List<Long> ownerCompanyIds;
    public Long defaultCompanyId;
    public Boolean allowPublic;
    public Boolean customPermissions;
    public Map<String, Map<String, Boolean>> permissions;
}
