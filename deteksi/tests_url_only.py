import os
from types import SimpleNamespace
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from unittest.mock import patch

from deteksi.services import evaluate_urls_with_heuristics, explain_url_with_groq, explain_with_groq


class URLOnlyDetectionTests(SimpleTestCase):
    def test_suspicious_url_heuristics(self):
        from deteksi.services import evaluate_url_heuristics

        suspicious, reason = evaluate_url_heuristics("https://bit.ly/claim-reward")
        self.assertTrue(suspicious)
        self.assertIn("claim", reason.lower())

        safe, _ = evaluate_url_heuristics("https://example.com")
        self.assertFalse(safe)

    def test_heuristics_check_all_urls_in_message(self):
        result = evaluate_urls_with_heuristics(
            "Cek https://bit.ly/claim-reward dan https://example.com"
        )

        self.assertEqual(result["status"], "suspicious")
        self.assertEqual(result["urls_checked"], 2)
        self.assertEqual(len(result["matches"]), 1)

    def test_groq_url_prompt_includes_safe_browsing_and_heuristics(self):
        url_analysis = {
            "safe_browsing": {
                "status": "unsafe",
                "matches": [{"url": "https://bit.ly/claim-reward", "threat_type": "SOCIAL_ENGINEERING"}],
                "urls_checked": 1,
            },
            "heuristics": {
                "status": "suspicious",
                "urls": ["https://bit.ly/claim-reward"],
                "matches": [{"url": "https://bit.ly/claim-reward", "reason": "Shortened URL."}],
                "urls_checked": 1,
            },
        }
        completion = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="Tautan ditandai berisiko."), finish_reason="stop")]
        )

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch("deteksi.services.Groq") as groq_mock:
            groq_mock.return_value.chat.completions.create.return_value = completion
            explanation = explain_url_with_groq(
                "https://bit.ly/claim-reward",
                url_analysis,
            )

        messages = groq_mock.return_value.chat.completions.create.call_args.kwargs["messages"]
        self.assertEqual(explanation, "Tautan ditandai berisiko.")
        self.assertIn("Bantu menilai tautan", messages[1]["content"])
        self.assertIn("bahasa Indonesia sehari-hari yang santai, natural", messages[0]["content"])
        self.assertIn("Jangan selalu memakai daftar atau poin", messages[0]["content"])
        self.assertIn("belum menjamin tautan aman", messages[0]["content"])
        self.assertIn("pelajaran untuk memeriksa tautan lain", messages[0]["content"].lower())
        self.assertIn("kenali indikator ancaman", messages[0]["content"].lower())
        self.assertIn("langkah aman yang konkret", messages[0]["content"].lower())
        self.assertIn("jangan mengklaim sudah melakukan tindakan", messages[0]["content"].lower())
        self.assertIn("Maksimal 200 kata total", messages[0]["content"])
        self.assertIn("SOCIAL_ENGINEERING", messages[1]["content"])
        self.assertIn("Shortened URL.", messages[1]["content"])
        self.assertIn("menebak modus jika bukti tidak cukup", messages[1]["content"])

    def test_message_groq_prompt_teaches_reasoning(self):
        completion = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="Pesan ini perlu diverifikasi."), finish_reason="stop")]
        )
        result = {"label_id": 1, "confidence": 0.9}

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch("deteksi.services.Groq") as groq_mock:
            groq_mock.return_value.chat.completions.create.return_value = completion
            explain_with_groq("Segera kirim OTP", result)

        messages = groq_mock.return_value.chat.completions.create.call_args.kwargs["messages"]
        self.assertIn("seolah sedang ngobrol langsung dengan teman", messages[0]["content"])
        self.assertIn("Jangan selalu memakai daftar atau poin", messages[0]["content"])
        self.assertIn("kutip bukti spesifik", messages[0]["content"])
        self.assertIn("tujuan atau modus", messages[0]["content"])
        self.assertIn("kenali indikator ancaman", messages[0]["content"].lower())
        self.assertIn("langkah aman yang konkret", messages[0]["content"].lower())
        self.assertIn("langkah aman yang dapat dilakukan pengguna", messages[1]["content"].lower())
        self.assertIn("tujuan/modus yang didukung bukti", messages[1]["content"].lower())
        self.assertIn("Maksimal 200 kata total", messages[0]["content"])

    def test_groq_explanation_is_capped_at_200_words(self):
        content = f"{'aman ' * 198}aman. {'lanjutan ' * 20}"
        completion = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content), finish_reason="stop")]
        )

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch("deteksi.services.Groq") as groq_mock:
            groq_mock.return_value.chat.completions.create.return_value = completion
            explanation = explain_with_groq(
                "Contoh pesan",
                {"label_id": 0, "confidence": 0.9},
            )

        self.assertLessEqual(len(explanation.split()), 200)
        self.assertTrue(explanation.endswith("."))

    @patch("deteksi.views.evaluate_urls_with_heuristics")
    @patch("deteksi.views.check_urls_with_safe_browsing")
    @patch("deteksi.views.explain_with_groq")
    @patch("deteksi.views.explain_url_with_groq")
    @patch("deteksi.views.predict_chat", return_value={"label_id": 0, "label": "normal", "confidence_percent": 90})
    def test_url_only_runs_all_checks_and_separate_groq_explanations(
        self, predict, url_explain, explain, safe_browsing, heuristics
    ):
        call_order = []
        safe_browsing.side_effect = lambda text: call_order.append("safe_browsing") or {
            "status": "unsafe",
            "matches": [{"url": "https://bit.ly/claim-reward", "threat_type": "SOCIAL_ENGINEERING"}],
            "urls_checked": 1,
        }
        heuristics.side_effect = lambda text: call_order.append("heuristics") or {
            "status": "suspicious",
            "matches": [{"url": "https://bit.ly/claim-reward", "reason": "Shortened URL."}],
            "urls_checked": 1,
        }
        url_explain.side_effect = lambda *args: call_order.append("groq_url") or "Penjelasan risiko tautan."
        explain.side_effect = lambda *args: call_order.append("groq_message") or "Penjelasan IndoBERT."

        response = self.client.post(
            "/api/analyze/",
            {"chat_text": "https://bit.ly/claim-reward"},
        )

        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["result"]["heuristic_check"]["status"], "suspicious")
        self.assertEqual(
            response_data["result"]["heuristic_check"]["matches"][0]["reason"],
            "Shortened URL.",
        )
        self.assertEqual(
            response_data["result"]["url_groq_explanation"],
            "Penjelasan risiko tautan.",
        )
        self.assertEqual(
            response_data["result"]["groq_explanation"],
            "Penjelasan IndoBERT.",
        )
        self.assertEqual(call_order, ["safe_browsing", "heuristics", "groq_url", "groq_message"])
        url_analysis = url_explain.call_args.args[1]
        self.assertEqual(url_analysis["safe_browsing"]["status"], "unsafe")
        self.assertEqual(url_analysis["heuristics"]["matches"][0]["reason"], "Shortened URL.")
        predict.assert_called_once()
        url_explain.assert_called_once()
        explain.assert_called_once()

    def test_homepage_serves_the_react_mount_point(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="root"')
        self.assertContains(response, "deteksi/frontend/assets/app.js")

    def test_analyze_endpoint_rejects_empty_text(self):
        response = self.client.post("/api/analyze/", {"chat_text": "   "})

        self.assertEqual(response.status_code, 400)
        self.assertIn("Masukkan isi chat", response.json()["error"])

    @patch(
        "deteksi.views.analyze_chat_text",
        return_value=({"label_id": 0, "label": "normal", "confidence_percent": 90}, {}),
    )
    @patch("deteksi.views.extract_pdf_text", return_value="Isi chat dari PDF")
    def test_analyze_endpoint_accepts_pdf_upload(self, extract_pdf, analyze):
        uploaded_pdf = SimpleUploadedFile(
            "percakapan.pdf",
            b"fake pdf content",
            content_type="application/pdf",
        )

        response = self.client.post("/api/analyze/", {"pdf_file": uploaded_pdf})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pdf_name"], "percakapan.pdf")
        self.assertEqual(response.json()["chat_text"], "Isi chat dari PDF")
        extract_pdf.assert_called_once()
        analyze.assert_called_once_with("Isi chat dari PDF")

    def test_csrf_endpoint_returns_a_token(self):
        response = self.client.get("/api/csrf/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["csrfToken"])
        self.assertIn("csrftoken", response.cookies)
