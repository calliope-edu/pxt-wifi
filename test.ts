const SSID = ""
const WIFI_PASSWORD = ""
const AIO_FEED = "light"
const AIO_USERNAME = ""
const AIO_KEY = ""
// Debug output (AT traffic) to USB serial at 115200 through extra-serial's
// second UART. extra-serial is only a test dependency of the extension.
// Registered before setupWifi so the whole setup is logged.
let debugOpen = false
WiFi.onDebugMessage(function (line) {
    if (!debugOpen) {
        extraserial.redirect(ExtraSerialPin.USB_TX, ExtraSerialPin.USB_RX, ExtraBaudRate.BaudRate115200)
        extraserial.setWriteLinePadding(0)   // default pads every line to 32 bytes
        debugOpen = true
    }
    extraserial.writeLine(line)
})

// Setup WiFi on startup (TX/RX default to C17/C16)
WiFi.setupWifi(SSID, WIFI_PASSWORD)
WiFi.setupAdafruitIO(AIO_USERNAME, AIO_KEY)
if (!WiFi.adafruitIOOK()) basic.showString("AIO?")

if (!WiFi.wifiOK()) {
    basic.forever(() => { })
}

// Post a value every 30 seconds, alternating number and text
let count = 0
basic.forever(() => {
    if (WiFi.wifiOK()) {
        if (count % 2 == 0) WiFi.adafruitIOPost(count, AIO_FEED)
        else WiFi.adafruitIOPost("text " + count, AIO_FEED)
        // number for "0", "2", ...; text for "text 1", ...
        let v = WiFi.adafruitIOGetValue(AIO_FEED)
        basic.showString("" + v)
        count++
    }
    basic.pause(5000)
})
