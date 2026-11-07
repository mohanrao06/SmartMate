@echo off
title SmartMate - Conversational RAG Assistant
echo ===================================================
echo           Starting SmartMate Web UI...
echo ===================================================

cd /d "%~dp0"
if exist ".venv\Scripts\streamlit.exe" (
    ".venv\Scripts\streamlit.exe" run app.py
) else if exist "SmartMate\.venv\Scripts\streamlit.exe" (
    cd SmartMate
    ".venv\Scripts\streamlit.exe" run app.py
) else (
    echo Error: Could not locate virtual environment .venv
    echo Please make sure the virtual environment exists.
)

pause

