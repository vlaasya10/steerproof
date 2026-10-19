package com.steerclub.steerproof.paper;

import com.steerclub.steerproof.common.IdGenerator;
import com.steerclub.steerproof.pipeline.PipelineService;
import com.steerclub.steerproof.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real upload bytes and controller handoff; scientific processing is deliberately not invoked. */
class StudioUploadContractTest {
    @TempDir Path directory;

    private IdGenerator ids() {
        var ids = mock(IdGenerator.class);
        when(ids.nextPaperId()).thenReturn("P-0001");
        return ids;
    }

    @Test void hallPdfIsStoredUnchangedAndHandedToTheExistingPipeline() throws Exception {
        var pdf = Files.readAllBytes(Path.of("../demo/papers/hall-kahan-2018.pdf"));
        var papers = mock(PaperRepository.class);
        var pipeline = mock(PipelineService.class);
        var storage = new StorageService(directory.toString());
        var controller = new PaperController(papers, null, null, null, pipeline, storage,
                ids(), null, null, null, null);
        MockMvcBuilders.standaloneSetup(controller).build().perform(multipart("/api/papers")
                .file(new MockMultipartFile("file", "hall-kahan-2018.pdf", "application/pdf", pdf))
                .param("theme", "Weight regain biology"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PARSING"));
        var saved = org.mockito.ArgumentCaptor.forClass(PaperEntity.class);
        verify(papers).save(saved.capture());
        assertArrayEquals(pdf, Files.readAllBytes(storage.resolve(saved.getValue().getPdfPath())));
        assertEquals("Weight regain biology", saved.getValue().getTheme());
        verify(pipeline).runPipeline(saved.getValue().getId());
    }

    @Test void sampleUrlAndEditorialThemeReachTheExistingPipeline() throws Exception {
        var papers = mock(PaperRepository.class);
        var pipeline = mock(PipelineService.class);
        var controller = new PaperController(papers, null, null, null, pipeline,
                new StorageService(directory.toString()), ids(), null, null, null, null);
        var url = "https://doi.org/10.1016/j.mcna.2017.08.012";
        MockMvcBuilders.standaloneSetup(controller).build().perform(multipart("/api/papers")
                .param("url", url).param("theme", "Weight regain biology"))
                .andExpect(status().isCreated());
        var saved = org.mockito.ArgumentCaptor.forClass(PaperEntity.class);
        verify(papers).save(saved.capture());
        assertEquals(url, saved.getValue().getSourceUrl());
        assertEquals("Weight regain biology", saved.getValue().getTheme());
        verify(pipeline).runPipeline(saved.getValue().getId());
        verify(papers, times(1)).save(any());
    }
}
