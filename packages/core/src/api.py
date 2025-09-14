#!/usr/bin/env python3

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
import tempfile
import subprocess
from pathlib import Path
import base64
import io

from generate import parse_range, generate_typst_file

app = FastAPI(title="Soroban Flashcard Generator API")

# Enable CORS for web apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FlashcardRequest(BaseModel):
    """Request model for generating flashcards"""
    range: str = Field("0-9", description="Number range (e.g., '0-99') or list (e.g., '1,2,5,10')")
    step: int = Field(1, description="Step/increment for ranges")
    cards_per_page: int = Field(6, description="Cards per page")
    paper_size: str = Field("us-letter", description="Paper size")
    orientation: Literal["portrait", "landscape"] = Field("portrait")
    margins: dict = Field(default_factory=lambda: {
        "top": "0.5in",
        "bottom": "0.5in", 
        "left": "0.5in",
        "right": "0.5in"
    })
    gutter: str = Field("5mm", description="Space between cards")
    shuffle: bool = False
    seed: Optional[int] = None
    show_cut_marks: bool = False
    show_registration: bool = False
    font_family: str = Field("DejaVu Sans")
    font_size: str = Field("48pt")
    columns: str = Field("auto", description="Number of soroban columns")
    show_empty_columns: bool = False
    hide_inactive_beads: bool = False
    bead_shape: Literal["diamond", "circle", "square"] = Field("diamond")
    color_scheme: Literal["monochrome", "place-value", "heaven-earth", "alternating"] = Field("monochrome")
    colored_numerals: bool = False
    scale_factor: float = Field(0.9, ge=0.1, le=1.0)
    format: Literal["pdf", "base64"] = Field("base64", description="Return format")

@app.post("/generate")
async def generate_flashcards(request: FlashcardRequest):
    """Generate flashcards and return as PDF bytes or base64"""
    
    try:
        # Parse numbers
        numbers = parse_range(request.range, request.step)
        
        if request.shuffle:
            import random
            if request.seed is not None:
                random.seed(request.seed)
            random.shuffle(numbers)
        
        # Build config
        config = {
            'cards_per_page': request.cards_per_page,
            'paper_size': request.paper_size,
            'orientation': request.orientation,
            'margins': request.margins,
            'gutter': request.gutter,
            'show_cut_marks': request.show_cut_marks,
            'show_registration': request.show_registration,
            'font_family': request.font_family,
            'font_size': request.font_size,
            'columns': request.columns,
            'show_empty_columns': request.show_empty_columns,
            'hide_inactive_beads': request.hide_inactive_beads,
            'bead_shape': request.bead_shape,
            'color_scheme': request.color_scheme,
            'colored_numerals': request.colored_numerals,
            'scale_factor': request.scale_factor,
        }
        
        # Create temp files
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            temp_typst = tmpdir_path / "flashcards.typ"
            temp_pdf = tmpdir_path / "flashcards.pdf"
            
            # Generate Typst file
            generate_typst_file(numbers, config, temp_typst)
            
            # Find project root and copy template
            project_root = Path(__file__).parent.parent
            templates_dir = project_root / "templates"
            
            # Copy templates to temp dir for imports to work
            import shutil
            temp_templates = tmpdir_path / "templates"
            shutil.copytree(templates_dir, temp_templates)
            
            # Compile with Typst
            result = subprocess.run(
                ["typst", "compile", str(temp_typst), str(temp_pdf)],
                capture_output=True,
                text=True,
                cwd=str(tmpdir_path)
            )
            
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Typst compilation failed: {result.stderr}")
            
            # Read PDF
            with open(temp_pdf, "rb") as f:
                pdf_bytes = f.read()
            
            # Return based on format
            if request.format == "pdf":
                return Response(
                    content=pdf_bytes,
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": "attachment; filename=flashcards.pdf"
                    }
                )
            else:  # base64
                return {
                    "pdf": base64.b64encode(pdf_bytes).decode('utf-8'),
                    "count": len(numbers),
                    "numbers": numbers[:100]  # Limit preview
                }
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.get("/")
async def root():
    """API documentation"""
    return {
        "name": "Soroban Flashcard Generator API",
        "endpoints": {
            "/generate": "POST - Generate flashcards",
            "/health": "GET - Health check",
            "/docs": "GET - Interactive API documentation"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)