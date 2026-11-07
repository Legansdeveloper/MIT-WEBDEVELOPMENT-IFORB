from io import BytesIO
import json

from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .services import check_urls_with_safe_browsing, evaluate_urls_with_heuristics, explain_url_with_groq, explain_with_groq, predict_chat, synthesize_elevenlabs_speech

MAX_PDF_SIZE = 20 * 1024 * 1024
MAX_TTS_SEGMENT_LENGTH = 200


@require_POST
def speak_analysis(request):
    try:
        payload = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Permintaan suara tidak valid."}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({"error": "Permintaan suara tidak valid."}, status=400)
    text = str(payload.get("text", "")).strip()
    if not text or len(text) > MAX_TTS_SEGMENT_LENGTH:
        return JsonResponse({"error": "Setiap potongan suara harus berisi 1–200 karakter."}, status=400)

    try:
        audio = synthesize_elevenlabs_speech(text)
    except ValueError as exception:
        return JsonResponse({"error": str(exception)}, status=400)
    except RuntimeError as exception:
        return JsonResponse({"error": str(exception)}, status=502)

    return HttpResponse(audio, content_type="audio/mpeg")


def extract_pdf_text(uploaded_pdf):
    if not uploaded_pdf.name.lower().endswith(".pdf"):
        raise ValueError("Pilih file dengan ekstensi .pdf.")
    if uploaded_pdf.size > MAX_PDF_SIZE:
        raise ValueError("Ukuran PDF maksimal 20 MB.")
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(uploaded_pdf.read()))
        if reader.is_encrypted:
            raise ValueError("PDF terkunci. Unggah PDF yang tidak memakai kata sandi.")
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except ValueError:
        raise
    except ImportError as exception:
        raise ValueError("Pembaca PDF belum terpasang. Jalankan pip install -r requirements.txt.") from exception
    except Exception as exception:
        raise ValueError("PDF tidak dapat dibaca. Pastikan file tidak rusak.") from exception
    if not text:
        raise ValueError("Tidak ada teks yang bisa dibaca dari PDF. PDF hasil scan memerlukan OCR.")
    return text


def check_chat(request):
    result = None
    error = None
    groq_error = None
    url_groq_error = None
    chat_text = ""
    pdf_name = ""

    if request.method == "POST":
        try:
            uploaded_pdf = request.FILES.get("pdf_file")
            if uploaded_pdf:
                chat_text = extract_pdf_text(uploaded_pdf)
                pdf_name = uploaded_pdf.name
            else:
                chat_text = request.POST.get("chat_text", "")

            result = predict_chat(chat_text)
            result["url_check"] = check_urls_with_safe_browsing(chat_text)
            result["heuristic_check"] = evaluate_urls_with_heuristics(chat_text)
            url_analysis = {
                "safe_browsing": {
                    "status": result["url_check"].get("status"),
                    "matches": result["url_check"].get("matches", []),
                    "urls_checked": result["url_check"].get("urls_checked", 0),
                },
                "heuristics": result["heuristic_check"],
            }
            if result["heuristic_check"]["status"] != "no_urls":
                try:
                    result["url_groq_explanation"] = explain_url_with_groq(chat_text, url_analysis)
                except RuntimeError as exception:
                    url_groq_error = str(exception)
            try:
                result["groq_explanation"] = explain_with_groq(chat_text, result)
            except RuntimeError as exception:
                groq_error = str(exception)
        except ValueError as exception:
            error = str(exception)
        except FileNotFoundError as exception:
            error = str(exception)
        except Exception:
            error = "Model gagal dimuat atau prediksi tidak dapat dilakukan. Periksa log server."

    return render(
        request,
        "deteksi/home.html",
        {
            "result": result,
            "error": error,
            "groq_error": groq_error,
            "url_groq_error": url_groq_error,
            "chat_text": chat_text,
            "pdf_name": pdf_name,
        },
    )
