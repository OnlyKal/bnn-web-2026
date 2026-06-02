import { useEffect, useRef, useState } from "react";
import ePub from "epubjs";
import {
    FaSearchPlus, FaSearchMinus, FaExpand, FaCompress, FaTimes, FaMinus,
    FaWindowMinimize, FaWindowMaximize, FaExclamationTriangle,
    FaChevronLeft, FaChevronRight, FaBook, FaList
} from 'react-icons/fa';

export default function EPUBViewer({ epubData, title = "EPUB", onClose, isLoading = false }) {
    const viewerRef = useRef(null);
    const containerRef = useRef(null);
    const bookRef = useRef(null);
    const renditionRef = useRef(null);
    const initRef = useRef(false);

    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false);
    const [bookTitle, setBookTitle] = useState("");
    const [toc, setToc] = useState([]);
    const [showToc, setShowToc] = useState(false);
    const [fontSize, setFontSize] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [viewerSize, setViewerSize] = useState("normal");

    useEffect(() => {
        // Don't run if no data, still loading, or already initialized
        if (!epubData || isLoading || initRef.current) return;
        // Must be Blob or ArrayBuffer
        if (!(epubData instanceof Blob) && !(epubData instanceof ArrayBuffer)) {
            console.error("[EPUB] Invalid data type:", typeof epubData);
            setError("Type de donnees invalide");
            return;
        }
        // Must have container
        if (!containerRef.current) {
            console.error("[EPUB] No container ref");
            setError("Container non disponible");
            return;
        }

        initRef.current = true;
        console.log("[EPUB] Starting initialization...");

        const init = async () => {
            try {
                // 1. Get ArrayBuffer
                const ab = epubData instanceof Blob
                    ? await epubData.arrayBuffer()
                    : epubData;
                console.log("[EPUB] ArrayBuffer size:", ab.byteLength);

                // 2. Verify ZIP signature
                const bytes = new Uint8Array(ab, 0, 4);
                console.log("[EPUB] File signature:", bytes[0].toString(16), bytes[1].toString(16), bytes[2].toString(16), bytes[3].toString(16));
                if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
                    const preview = new TextDecoder().decode(new Uint8Array(ab, 0, Math.min(200, ab.byteLength)));
                    console.error("[EPUB] Not a ZIP. Content:", preview);
                    throw new Error("Fichier non valide (pas un ZIP/EPUB)");
                }

                // 3. Create epub book
                console.log("[EPUB] Creating ePub book...");
                const book = ePub(ab);
                bookRef.current = book;

                // 4. Wait for book to be ready
                console.log("[EPUB] Waiting for book.ready...");
                await book.ready;
                console.log("[EPUB] Book is ready!");

                // 5. Get metadata
                try {
                    const meta = await book.loaded.metadata;
                    console.log("[EPUB] Metadata:", meta);
                    if (meta && meta.title) setBookTitle(meta.title);
                } catch (e) {
                    console.warn("[EPUB] Metadata error (non-fatal):", e);
                }

                // 6. Get TOC
                try {
                    const nav = await book.loaded.navigation;
                    if (nav && nav.toc && nav.toc.length > 0) {
                        console.log("[EPUB] TOC:", nav.toc.length, "items");
                        setToc(nav.toc);
                    }
                } catch (e) {
                    console.warn("[EPUB] TOC error (non-fatal):", e);
                }

                // 7. Clear container and render
                containerRef.current.innerHTML = "";
                console.log("[EPUB] Rendering to container...");

                const rendition = book.renderTo(containerRef.current, {
                    width: "100%",
                    height: "100%",
                    spread: "none",
                    flow: "scrolled-doc",
                    allowScriptedContent: false
                });
                renditionRef.current = rendition;

                // 8. Set default theme
                rendition.themes.default({
                    body: {
                        "font-family": 'Georgia, "Times New Roman", serif !important',
                        "line-height": "1.8 !important",
                        color: "#222 !important",
                        padding: "20px 30px !important",
                        "max-width": "100% !important"
                    },
                    img: {
                        "max-width": "100% !important",
                        height: "auto !important"
                    }
                });
                rendition.themes.fontSize(fontSize + "%");

                // 9. Display first page
                console.log("[EPUB] Calling rendition.display()...");
                await rendition.display();
                console.log("[EPUB] Display complete! EPUB is showing.");

                setReady(true);
            } catch (err) {
                console.error("[EPUB] FATAL ERROR:", err);
                setError(err.message || "Erreur inconnue");
            }
        };

        init();

        // Cleanup
        return () => {
            console.log("[EPUB] Cleanup");
            if (renditionRef.current) {
                try { renditionRef.current.destroy(); } catch (e) {}
            }
            if (bookRef.current) {
                try { bookRef.current.destroy(); } catch (e) {}
            }
        };
    }, [epubData, isLoading]);

    // Font size update
    useEffect(() => {
        if (renditionRef.current && ready) {
            renditionRef.current.themes.fontSize(fontSize + "%");
        }
    }, [fontSize, ready]);

    // Keyboard
    useEffect(() => {
        const h = (e) => {
            if (e.key === "Escape" && onClose) onClose();
            if (e.key === "ArrowLeft" && renditionRef.current) renditionRef.current.prev();
            if (e.key === "ArrowRight" && renditionRef.current) renditionRef.current.next();
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    // Fullscreen
    useEffect(() => {
        const h = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", h);
        return () => document.removeEventListener("fullscreenchange", h);
    }, []);

    const goPrev = () => renditionRef.current && renditionRef.current.prev();
    const goNext = () => renditionRef.current && renditionRef.current.next();
    const goToHref = (href) => { renditionRef.current && renditionRef.current.display(href); setShowToc(false); };
    const toggleFs = () => isFullscreen ? document.exitFullscreen() : viewerRef.current?.requestFullscreen();

    const cls = ["pdf-viewer-modal",
        viewerSize === "minimized" && "pdf-viewer-minimized",
        viewerSize === "enlarged" && "pdf-viewer-enlarged",
        isFullscreen && "pdf-viewer-fullscreen"
    ].filter(Boolean).join(" ");

    const spinning = isLoading || (!ready && !error && !!epubData);

    return (
        <div className="pdf-viewer-overlay" onContextMenu={e => e.preventDefault()}>
            <div className={cls} ref={viewerRef}>
                {/* HEADER */}
                <div className="pdf-viewer-header">
                    <div className="pdf-viewer-title">
                        <FaBook style={{ marginRight: 8 }} />
                        <span className="pdf-viewer-title-text">{bookTitle || title}</span>
                        <span className="pdf-viewer-badge" style={{ backgroundColor: "#10b981" }}>EPUB</span>
                    </div>
                    <div className="pdf-viewer-controls">
                        <div className="pdf-viewer-control-group">
                            <button className="pdf-viewer-btn" onClick={goPrev} disabled={!ready}><FaChevronLeft /></button>
                            <button className="pdf-viewer-btn" onClick={goNext} disabled={!ready}><FaChevronRight /></button>
                        </div>
                        {toc.length > 0 && (
                            <div className="pdf-viewer-control-group">
                                <button className={"pdf-viewer-btn" + (showToc ? " active" : "")} onClick={() => setShowToc(p => !p)}><FaList /></button>
                            </div>
                        )}
                        <div className="pdf-viewer-control-group">
                            <button className="pdf-viewer-btn" onClick={() => setFontSize(s => Math.max(60, s - 10))}><FaSearchMinus /></button>
                            <span className="pdf-viewer-zoom-level">{fontSize}%</span>
                            <button className="pdf-viewer-btn" onClick={() => setFontSize(s => Math.min(200, s + 10))}><FaSearchPlus /></button>
                        </div>
                        <div className="pdf-viewer-control-group">
                            <button className={"pdf-viewer-btn" + (viewerSize === "minimized" ? " active" : "")} onClick={() => setViewerSize("minimized")}><FaWindowMinimize /></button>
                            <button className={"pdf-viewer-btn" + (viewerSize === "normal" ? " active" : "")} onClick={() => setViewerSize("normal")}><FaMinus style={{ transform: "rotate(90deg)" }} /></button>
                            <button className={"pdf-viewer-btn" + (viewerSize === "enlarged" ? " active" : "")} onClick={() => setViewerSize("enlarged")}><FaWindowMaximize /></button>
                            <button className={"pdf-viewer-btn" + (isFullscreen ? " active" : "")} onClick={toggleFs}>{isFullscreen ? <FaCompress /> : <FaExpand />}</button>
                        </div>
                        <button className="pdf-viewer-btn pdf-viewer-close-btn" onClick={onClose}><FaTimes /></button>
                    </div>
                </div>

                {/* BODY */}
                <div className="pdf-viewer-body" style={{ position: "relative", display: "flex" }}>
                    {/* TOC */}
                    {showToc && toc.length > 0 && (
                        <div style={{ width: 250, borderRight: "1px solid #e5e7eb", background: "#f9fafb", overflowY: "auto", flexShrink: 0 }}>
                            <div style={{ padding: "1rem", fontWeight: "bold", borderBottom: "1px solid #e5e7eb" }}>Table des matières</div>
                            {toc.map((item, i) => (
                                <div key={i} onClick={() => goToHref(item.href)}
                                    style={{ padding: "0.6rem 1rem", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid #f0f0f0" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#e0e7ff"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >{item.label}</div>
                            ))}
                        </div>
                    )}

                    {/* CONTENT */}
                    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                        {spinning && (
                            <div className="pdf-viewer-loading">
                                <div className="pdf-viewer-spinner"></div>
                                <span>Chargement du document EPUB...</span>
                            </div>
                        )}
                        {error && (
                            <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "#fff" }}>
                                <FaExclamationTriangle style={{ fontSize: "2.5rem", marginBottom: "1rem", color: "#f59e0b" }} />
                                <span style={{ marginBottom: "0.5rem", fontWeight: "bold" }}>Erreur EPUB</span>
                                <span style={{ marginBottom: "1.5rem", textAlign: "center", color: "#666", maxWidth: 400 }}>{error}</span>
                                <button className="pdf-viewer-btn" onClick={onClose} style={{ padding: "0.5rem 1.5rem" }}>Fermer</button>
                            </div>
                        )}
                        <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "auto", background: "#fff" }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
