package com.steerclub.steerproof.paper;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaperRepository extends JpaRepository<PaperEntity, String> {
    List<PaperEntity> findAllByOrderByCreatedAtDesc();
    long countByPdfPath(String pdfPath);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from PaperEntity p where p.id = :id")
    java.util.Optional<PaperEntity> findForUpdate(@org.springframework.data.repository.query.Param("id") String id);
}
