package com.vinhcancode.sales.service;

import com.vinhcancode.sales.entity.AuditLog;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import org.eclipse.microprofile.jwt.JsonWebToken;

@ApplicationScoped
public class AuditService {

    @Inject
    JsonWebToken jwt;

    @Inject
    EntityManager em;

    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void log(String module, String action, String targetId, String description) {
        try {
            String username = jwt != null && jwt.getName() != null && !jwt.getName().isBlank()
                    ? jwt.getName()
                    : "system";
            AuditLog audit = new AuditLog();
            audit.username = username;
            audit.module = module != null ? module.toLowerCase() : "system";
            audit.action = action != null ? action.toUpperCase() : "ACTION";
            audit.targetId = targetId;
            audit.description = description != null ? description : "";
            audit.createdAt = OffsetDateTime.now();
            em.persist(audit);
        } catch (Exception e) {
            // Không làm gián đoạn transaction chính nếu ghi audit log gặp sự cố
        }
    }
}

