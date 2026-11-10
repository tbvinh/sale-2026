package com.vinhcancode.sales.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.vinhcancode.sales.entity.DmCongTy;
import java.util.List;

public class CompanyRequest {

    public String code;
    public String name;
    public String address;

    @JsonAlias("tax_code")
    public String taxCode;

    public String phone;

    @JsonAlias("schema_name")
    public String schemaName;

    public String status;

    /** Tu dong tao tai khoan owner (mac dinh user_<code_cong_ty>, role company_admin) khi tao cong ty moi. */
    public Boolean autoCreateOwner;
    public String ownerUsername;
    public String ownerPassword;
    public String ownerFullName;

    /** Gan user co san lam Owner cua cong ty. */
    public Long ownerUserId;

    /** Danh sach user_id duoc phep quan tri/lam viec tren cong ty nay. */
    public List<Long> userIds;

    public DmCongTy toEntity() {
        DmCongTy c = new DmCongTy();
        c.code = code;
        c.name = name;
        c.address = address;
        c.taxCode = taxCode;
        c.phone = phone;
        c.schemaName = schemaName;
        c.status = status;
        return c;
    }
}

