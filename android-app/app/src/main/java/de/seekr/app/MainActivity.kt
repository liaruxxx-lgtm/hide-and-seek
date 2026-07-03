package de.seekr.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import java.net.URI

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var errorPanel: LinearLayout
    private lateinit var serverInput: EditText
    private lateinit var errorDetail: TextView

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGeolocation: PendingGeolocation? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var mainFrameFailed = false
    private var nativeLocationStarted = false

    private val locationManager by lazy {
        getSystemService(Context.LOCATION_SERVICE) as LocationManager
    }

    private val nativeLocationListener = LocationListener { location ->
        pushNativeLocation(location)
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        finishGeolocationPermissionRequest()
    }

    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        pendingWebPermission?.let { request ->
            if (grants.values.all { it }) {
                grantRecognizedWebResources(request)
            } else {
                request.deny()
            }
        }
        pendingWebPermission = null
    }

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = if (result.resultCode == RESULT_OK) {
            result.data?.clipData?.let { clips ->
                Array(clips.itemCount) { index -> clips.getItemAt(index).uri }
            } ?: result.data?.data?.let { arrayOf(it) }
        } else {
            null
        }
        fileCallback?.onReceiveValue(uris)
        fileCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        buildUi()
        configureWebView()
        configureBackNavigation()

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            loadServer(savedServerUrl())
        }
    }

    private fun buildUi() {
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(5, 6, 8))
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(5, 6, 8))
        }
        root.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        errorPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(Color.rgb(5, 6, 8))
            visibility = View.GONE
        }

        val title = TextView(this).apply {
            text = getString(R.string.connection_title)
            setTextColor(Color.rgb(247, 249, 251))
            textSize = 24f
            gravity = Gravity.CENTER
        }
        errorPanel.addView(title, matchWrap(marginBottom = 12))

        errorDetail = TextView(this).apply {
            text = getString(R.string.connection_help)
            setTextColor(Color.rgb(154, 162, 170))
            textSize = 15f
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.2f)
        }
        errorPanel.addView(errorDetail, matchWrap(marginBottom = 24))

        serverInput = EditText(this).apply {
            hint = getString(R.string.server_url_hint)
            setSingleLine(true)
            setTextColor(Color.WHITE)
            setHintTextColor(Color.rgb(116, 124, 132))
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = roundedBackground(Color.rgb(21, 24, 28), Color.rgb(65, 70, 76))
        }
        errorPanel.addView(serverInput, matchWrap(marginBottom = 12))

        val connect = actionButton(getString(R.string.connect)) {
            val normalized = normalizeServerUrl(serverInput.text.toString())
            if (normalized == null) {
                serverInput.error = "Bitte eine gültige HTTP- oder HTTPS-Adresse eingeben."
            } else {
                preferences().edit().putString(PREF_SERVER_URL, normalized).apply()
                loadServer(normalized)
            }
        }
        errorPanel.addView(connect, matchWrap(marginBottom = 10))

        val retry = actionButton(getString(R.string.retry)) {
            loadServer(savedServerUrl())
        }.apply {
            background = roundedBackground(Color.rgb(33, 37, 42), Color.rgb(82, 88, 95))
        }
        errorPanel.addView(retry, matchWrap())

        root.addView(
            errorPanel,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        setContentView(root)
    }

    @Suppress("SetJavaScriptEnabled")
    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString SEEKR-Android/${BuildConfig.VERSION_NAME}"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val target = request.url
                val server = Uri.parse(savedServerUrl())
                if (target.host == server.host) return false

                startActivity(Intent(Intent.ACTION_VIEW, target))
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!mainFrameFailed) {
                    errorPanel.visibility = View.GONE
                    webView.visibility = View.VISIBLE
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    mainFrameFailed = true
                    showConnectionError(error.description.toString())
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                requestGeolocation(origin, callback)
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { handleWebPermission(request) }
            }

            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = fileChooserParams.acceptTypes.firstOrNull { it.isNotBlank() } ?: "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                }
                filePickerLauncher.launch(intent)
                return true
            }
        }

        webView.setDownloadListener(
            DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                enqueueDownload(url, userAgent, contentDisposition, mimeType)
            }
        )
    }

    private fun loadServer(url: String) {
        mainFrameFailed = false
        serverInput.setText(url)
        errorPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(url)
    }

    private fun showConnectionError(detail: String) {
        errorDetail.text = getString(
            R.string.connection_error_detail,
            getString(R.string.connection_help),
            detail
        )
        serverInput.setText(savedServerUrl())
        webView.visibility = View.GONE
        errorPanel.visibility = View.VISIBLE
    }

    private fun requestGeolocation(
        origin: String,
        callback: GeolocationPermissions.Callback
    ) {
        if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            callback.invoke(origin, true, false)
            startNativeLocationUpdates()
            return
        }

        pendingGeolocation = PendingGeolocation(origin, callback)
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    private fun handleWebPermission(request: PermissionRequest) {
        val requestedAndroidPermissions = buildList {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in request.resources &&
                !hasPermission(Manifest.permission.CAMERA)
            ) {
                add(Manifest.permission.CAMERA)
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in request.resources &&
                !hasPermission(Manifest.permission.RECORD_AUDIO)
            ) {
                add(Manifest.permission.RECORD_AUDIO)
            }
        }

        if (requestedAndroidPermissions.isEmpty()) {
            grantRecognizedWebResources(request)
        } else {
            pendingWebPermission = request
            mediaPermissionLauncher.launch(requestedAndroidPermissions.toTypedArray())
        }
    }

    private fun grantRecognizedWebResources(request: PermissionRequest) {
        val allowed = request.resources.filter {
            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE ||
                it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
        }
        if (allowed.isEmpty()) request.deny() else request.grant(allowed.toTypedArray())
    }

    private fun enqueueDownload(
        url: String,
        userAgent: String?,
        contentDisposition: String?,
        mimeType: String?
    ) {
        try {
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", userAgent)
                CookieManager.getInstance().getCookie(url)?.let {
                    addRequestHeader("Cookie", it)
                }
                setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType))
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(
                    Environment.DIRECTORY_DOWNLOADS,
                    URLUtil.guessFileName(url, contentDisposition, mimeType)
                )
            }
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            Toast.makeText(this, "Download gestartet.", Toast.LENGTH_SHORT).show()
        } catch (_: Exception) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun finishGeolocationPermissionRequest() {
        val pending = pendingGeolocation ?: return
        val granted = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) ||
            hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
        pending.callback.invoke(pending.origin, granted, false)
        pendingGeolocation = null
        if (granted) {
            startNativeLocationUpdates()
            webView.postDelayed(
                {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new Event('seekr:native-location-granted'))",
                        null
                    )
                },
                250
            )
        }
        if (!granted && !shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) {
            showPermissionSettingsHint("Standort")
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    private fun configureBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        if (nativeLocationStarted) {
            locationManager.removeUpdates(nativeLocationListener)
        }
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    private fun savedServerUrl(): String =
        preferences().getString(PREF_SERVER_URL, BuildConfig.DEFAULT_SERVER_URL)
            ?: BuildConfig.DEFAULT_SERVER_URL

    private fun preferences() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun normalizeServerUrl(value: String): String? {
        val candidate = value.trim().let {
            if (it.startsWith("http://") || it.startsWith("https://")) it else "http://$it"
        }.trimEnd('/')

        return try {
            val uri = URI(candidate)
            if ((uri.scheme == "http" || uri.scheme == "https") && !uri.host.isNullOrBlank()) {
                candidate
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun showPermissionSettingsHint(permissionName: String) {
        AlertDialog.Builder(this)
            .setTitle("$permissionName freigeben")
            .setMessage("Die Freigabe wurde dauerhaft blockiert. Öffne die App-Einstellungen, um sie zu ändern.")
            .setNegativeButton("Später", null)
            .setPositiveButton("Einstellungen") { _, _ ->
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                })
            }
            .show()
    }

    @SuppressLint("MissingPermission")
    private fun startNativeLocationUpdates() {
        if (nativeLocationStarted ||
            (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) &&
                !hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION))
        ) {
            return
        }

        nativeLocationStarted = true
        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER
        ).filter { provider ->
            runCatching { locationManager.isProviderEnabled(provider) }.getOrDefault(false)
        }

        for (provider in providers) {
            runCatching {
                locationManager.requestLocationUpdates(
                    provider,
                    NATIVE_LOCATION_INTERVAL_MS,
                    NATIVE_LOCATION_MIN_DISTANCE_METERS,
                    nativeLocationListener,
                    Looper.getMainLooper()
                )
            }
        }

        providers
            .mapNotNull { provider ->
                runCatching { locationManager.getLastKnownLocation(provider) }.getOrNull()
            }
            .filter { location ->
                System.currentTimeMillis() - location.time <= MAX_LAST_LOCATION_AGE_MS
            }
            .maxByOrNull(Location::getTime)
            ?.let(::pushNativeLocation)
    }

    private fun pushNativeLocation(location: Location) {
        val accuracy = if (location.hasAccuracy()) location.accuracy else 100f
        val script = """
            window.dispatchEvent(new CustomEvent('seekr:native-location', {
              detail: {
                latitude: ${location.latitude},
                longitude: ${location.longitude},
                accuracy: $accuracy
              }
            }))
        """.trimIndent()
        webView.post { webView.evaluateJavascript(script, null) }
    }

    private fun hasPermission(permission: String): Boolean =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 15f
        setTextColor(Color.rgb(5, 6, 8))
        background = roundedBackground(Color.rgb(247, 249, 251), Color.WHITE)
        setOnClickListener { action() }
    }

    private fun roundedBackground(fill: Int, stroke: Int) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(14).toFloat()
        setColor(fill)
        setStroke(dp(1), stroke)
    }

    private fun matchWrap(marginBottom: Int = 0) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    ).apply {
        bottomMargin = dp(marginBottom)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private data class PendingGeolocation(
        val origin: String,
        val callback: GeolocationPermissions.Callback
    )

    companion object {
        private const val PREFS = "seekr_android"
        private const val PREF_SERVER_URL = "server_url"
        private const val NATIVE_LOCATION_INTERVAL_MS = 1000L
        private const val NATIVE_LOCATION_MIN_DISTANCE_METERS = 1f
        private const val MAX_LAST_LOCATION_AGE_MS = 60_000L
    }
}
