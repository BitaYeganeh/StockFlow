<?php

namespace StockFlow\AI;

/**
 * GeminiAI - PHP class for Google Gemini API
 *
 * Uses dynamic model selection to avoid “model not found” errors.
 */
class GeminiAI
{
    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = $_ENV['GEMINI_API_KEY'] ?? '';

        if (empty($this->apiKey)) {
            throw new \Exception('GEMINI_API_KEY is not set in .env');
        }
    }

    /**
     * List all models available for this API key
     *
     * @return array
     */
    public function listModels(): array
    {
        $url = "https://generativelanguage.googleapis.com/v1beta/models?key=" . $this->apiKey;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"]
        ]);

        $response = curl_exec($ch);
        $decoded = json_decode($response, true);

        return $decoded['models'] ?? [];
    }

    /**
     * Send a prompt to Gemini and get a text response
     *
     * @param string $prompt
     * @return string
     * @throws \Exception
     */
    public function ask(string $prompt): string
    {
        // Step 1: find a valid model that supports generateContent
        $models = $this->listModels();
        $modelId = null;

        foreach ($models as $model) {
            if (isset($model['supportedGenerationMethods']) &&
                in_array('generateContent', $model['supportedGenerationMethods'])) {
                // strip "models/" prefix
                $modelId = str_replace('models/', '', $model['name']);
                break;
            }
        }

        if (!$modelId) {
            throw new \Exception("No valid model found for generateContent. Check your API key permissions.");
        }

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelId}:generateContent?key=" . $this->apiKey;

        $data = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ]
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($data)
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        if ($error) {
            throw new \Exception("Gemini request failed: " . $error);
        }

        $decoded = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMsg = $decoded['error']['message'] ?? $response;
            throw new \Exception("Gemini API error: " . $errorMsg);
        }

        return $decoded['candidates'][0]['content']['parts'][0]['text'] ?? 'No response';
    }
}