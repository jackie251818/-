@echo off

REM 检查是否安装了Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 未找到Python，尝试使用PowerShell启动Web服务器...
    powershell -Command "
        $listener = New-Object System.Net.HttpListener;
        $listener.Prefixes.Add('http://localhost:8000/');
        $listener.Start();
        Write-Host 'Web服务器已启动在 http://localhost:8000/';
        Write-Host '按任意键停止服务器...';
        while ($listener.IsListening) {
            $context = $listener.GetContextAsync().GetAwaiter().GetResult();
            $request = $context.Request;
            $response = $context.Response;
            $path = $request.Url.LocalPath;
            if ($path -eq '/') { $path = '/index.html'; }
            $filePath = Join-Path (Get-Location) $path;
            if (Test-Path $filePath -PathType Leaf) {
                $content = Get-Content -Path $filePath -Raw;
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($content);
                $response.ContentLength64 = $buffer.Length;
                $response.OutputStream.Write($buffer, 0, $buffer.Length);
            } else {
                $response.StatusCode = 404;
            }
            $response.Close();
        }
    "
) else (
    echo 正在使用Python启动Web服务器...
    python -m http.server 8000
)

pause