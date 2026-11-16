# pxt-wifi

A MakeCode extension for the **Calliope mini** that drives the **Calliope WiFi Module** (ESP AT-firmware based). Supports exchanging data with **ThingSpeak**, **IFTTT**, and **Adafruit IO**, as well as sending raw TCP/UDP messages.

## Hardware

- [Calliope mini](https://calliope.cc/)
- [Grove - UART WiFi V2 )](https://wiki.seeedstudio.com/Grove-UART_Wifi_V2/)

Default wiring:

| Module | Calliope mini pin |
|--------|-------------------|
| TX     | C16               |
| RX     | C17               |

## Blocks

### Setup WiFi

Connect to a WiFi network. Call this once at startup.

```blocks
WiFi.setupWifi("MySSID", "MyPassword")
```

TX/RX pins default to C17/C16; expand the block to change them. While connecting the
LEDs show an animation, followed by a checkmark (connected) or an X (failed).

### Check connection

```blocks
if (WiFi.wifiOK()) {
    basic.showString("OK")
}
```

### Send to ThingSpeak

```blocks
WiFi.setupThingSpeak("YOUR_WRITE_API_KEY")
WiFi.sendToThingSpeak(23.5)
```

### Send to IFTTT

```blocks
WiFi.setupIFTTT("YOUR_KEY")
WiFi.sendToIFTTT("my_event", "Hello", "Calliope", "mini")
```

### Adafruit IO – setup

Run after "Setup Wifi": the block checks the username and AIO Key with Adafruit IO.

```blocks
WiFi.setupAdafruitIO("username", "YOUR_AIO_KEY")
if (WiFi.adafruitIOOK()) {
    basic.showIcon(IconNames.Yes)
}
```

### Adafruit IO – POST a value

The value can be a number or a text.

```blocks
WiFi.adafruitIOPost(42, "feed-name")
```

### Adafruit IO – GET the latest value

Returns a number if the feed's value is a number, otherwise the text (0 if nothing could be read).

```typescript
let val = WiFi.adafruitIOGetValue("feed-name")
basic.showNumber(val)
```

### Send a raw TCP / UDP message

```blocks
WiFi.sendMessage(MessageType.TCP, "192.168.1.10", 1234, "hello")
```

## License

MIT

## Supported targets

* [Calliope mini](https://calliope.cc/) (`calliope`)
