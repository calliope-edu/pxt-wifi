const SSID = "YOUR_SSID"
const WIFI_PASSWORD = "YOUR_PASSWORD"
const AIO_USERNAME = "YOUR_AIO_USERNAME"
const AIO_KEY = "YOUR_AIO_KEY"
const AIO_FEED = "temperature"

// Setup WiFi on startup
WiFi.setupWifi(
    SerialPin.C17,
    SerialPin.C16,
    BaudRate.BaudRate115200,
    SSID,
    WIFI_PASSWORD
)

if (WiFi.wifiOK()) {
    basic.showIcon(IconNames.Yes)
} else {
    basic.showIcon(IconNames.No)
    basic.forever(() => { })
}

// Post a value every 30 seconds
let count = 0
basic.forever(() => {
    if (WiFi.wifiOK()) {
        let value = count.toString()
        WiFi.adafruitIOPost(AIO_USERNAME, AIO_KEY, AIO_FEED, value)
        count++
        basic.showNumber(count)
    }
    basic.pause(30000)
})
