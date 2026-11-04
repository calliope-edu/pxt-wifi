enum MessageType {
    UDP,
    TCP
}
/**
 * Functions to operate Grove module.
 */
//% weight=50 color=#6476fd icon="" block="WiFi"
//% groups='["Connection", "Adafruit IO", "ThingSpeak", "IFTTT", "Thingsboard"]'
namespace WiFi {
    /**
     * 
     */

    let isWifiConnected = false;
    // Pins the module is wired to, set by setupWifi.
    let wifiTx = SerialPin.C17
    let wifiRx = SerialPin.C16

    // Credentials stored by the "setup ..." blocks, used by the matching send/get blocks.
    // WiFi password, kept only to hide it in debug output.
    let wifiPasswd = ""
    let aioUsername = ""
    let aioKey = ""
    // Set by setupAdafruitIO: Adafruit IO accepted the username and AIO Key.
    let aioOk = false
    let thingSpeakKey = ""
    let iftttKey = ""

    // Every block below drives the one shared UART to the ESP32. loops.everyInterval runs
    // its body in a separate fiber, so without this two blocks interleave their AT commands
    // mid-exchange and each reads the other's replies.
    let busy = false

    function acquire() {
        while (busy) basic.pause(10)
        busy = true
    }

    function release() {
        busy = false
    }

    // ---- connection animation (ported from pxt-WiFiLive) ----
    // True while the animation fiber is still playing its frames.
    let animRunning = false
    // Set by endConnectAnim: the fiber stops after the cycle it is playing.
    let animStop = false

    // Loop WiFi bars filling up in the background while setupWifi / setupAdafruitIO carry on,
    // until endConnectAnim stops it. A cycle always plays to the end, so the
    // animation never cuts off halfway. Each showLeds holds its frame for the
    // default 400 ms.
    function startConnectAnim() {
        animRunning = true
        animStop = false
        control.inBackground(function () {
            while (!animStop) {
                basic.showLeds(`
                    . . . . .
                    . . . . .
                    . . . . .
                    . . . . .
                    . . # . .
                    `)
                basic.showLeds(`
                    . . . . .
                    . . . . .
                    . # # # .
                    . . . . .
                    . . # . .
                    `)
                basic.showLeds(`
                    # # # # #
                    . . . . .
                    . # # # .
                    . . . . .
                    . . # . .
                    `)
            }
            animRunning = false
        })
    }

    // Stop the loop, wait for its current cycle to finish, then show a
    // checkmark if the connection succeeded or an X if it failed.
    function endConnectAnim(ok: boolean) {
        animStop = true
        while (animRunning) basic.pause(20)
        if (ok) basic.showLeds(`
            . . . . .
            . . . . #
            . . . # .
            # . # . .
            . # . . .
            `)
        else basic.showLeds(`
            # . . . #
            . # . # .
            . . # . .
            . # . # .
            # . . . #
            `)
    }
    /**
     * Setup Grove - Uart WiFi V2 to connect to  Wi-Fi
     */
    //% block="Setup Wifi|SSID = %ssid|Password = %passwd||TX %txPin|RX %rxPin"
    //% ssid.defl="SSID"
    //% passwd.defl="Password"
    //% txPin.defl=SerialPin.C17
    //% rxPin.defl=SerialPin.C16
    //% expandableArgumentMode="toggle"
    //% group="Connection"
    //% weight=90
    export function setupWifi(ssid: string, passwd: string, txPin?: SerialPin, rxPin?: SerialPin) {
        acquire()
        let result = 0

        isWifiConnected = false
        wifiPasswd = passwd
        wifiTx = !txPin ? SerialPin.C17 : txPin
        wifiRx = !rxPin ? SerialPin.C16 : rxPin
        startConnectAnim()

        // The module runs at its default 115200 baud.
        serial.redirect(wifiTx, wifiRx, BaudRate.BaudRate115200)
        serialOffUsb = true
        // The default RX buffer is far smaller than one HTTP reply; at 115200 baud it
        // overflows between two reads and the reply arrives with chunks missing.
        serial.setRxBufferSize(254)

        // The module may still be booting (it prints "ready" when done); anything sent
        // before then is lost. Retry AT until it answers, up to ~5 s.
        for (let i = 0; i < 5; i++) {
            sendAtCmd("AT")
            result = waitAtResponse("OK", "ready", "None", 1000)
            if (result == 2) {
                // "ready" just arrived: give it a moment, then the next AT is answered
                basic.pause(200)
                continue
            }
            if (result == 1) break
        }

        sendAtCmd("AT+SYSSTORE=0")
        result = waitAtResponse("OK", "ERROR", "FAIL", 3000)

        sendAtCmd("AT+CWMODE=1")
        result = waitAtResponse("OK", "ERROR", "None", 1000)

        sendAtCmd(`AT+CWJAP="${ssid}","${passwd}"`)
        result = waitAtResponse("WIFI GOT IP", "ERROR", "None", 20000)

        if (result == 1) {
            isWifiConnected = true
        }
        note(isWifiConnected ? "wifi: connected to " + ssid : "wifi: connect FAILED")
        endConnectAnim(isWifiConnected)
        release()
    }

    /**
     * Check if Grove - Uart WiFi V2 is connected to Wifi
     */
    //% block="Wifi OK?"
    //% weight=85
    //% group="Connection"
    export function wifiOK() {
        return isWifiConnected
    }

    /**
     * Set the ThingSpeak channel's Write API Key used by "Send Data to ThingSpeak"
     */
    //% block="Setup ThingSpeak|Write API Key %apiKey"
    //% group="ThingSpeak"
    //% apiKey.defl="your Write API Key"
    //% weight=72
    export function setupThingSpeak(apiKey: string) {
        thingSpeakKey = apiKey
    }

    /**
     * Send data to ThingSpeak
     */
    //% block="Send Data to ThingSpeak|Field1 %field1|Field2 %field2||Field3 %field3|Field4 %field4|Field5 %field5|Field6 %field6|Field7 %field7|Field8 %field8"
    //% group="ThingSpeak"
    //% expandableArgumentMode="enabled"
    //% weight=70
    export function sendToThingSpeak(field1: number = 0, field2: number = 0, field3: number = 0, field4: number = 0, field5: number = 0, field6: number = 0, field7: number = 0, field8: number = 0) {
        acquire()
        let result = 0
        let retry = 2

        // close the previous TCP connection
        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }

        while (isWifiConnected && retry > 0) {
            retry = retry - 1;
            // establish TCP connection
            sendAtCmd("AT+CIPSTART=\"TCP\",\"api.thingspeak.com\",80")
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 2000)
            if (result == 3) continue

            let data = "GET /update?api_key=" + thingSpeakKey
            if (!isNaN(field1)) data = data + "&field1=" + field1
            if (!isNaN(field2)) data = data + "&field2=" + field2
            if (!isNaN(field3)) data = data + "&field3=" + field3
            if (!isNaN(field4)) data = data + "&field4=" + field4
            if (!isNaN(field5)) data = data + "&field5=" + field5
            if (!isNaN(field6)) data = data + "&field6=" + field6
            if (!isNaN(field7)) data = data + "&field7=" + field7
            if (!isNaN(field8)) data = data + "&field8=" + field8

            sendAtCmd("AT+CIPSEND=" + (data.length + 2))
            result = waitSendPrompt(2000)
            if (result != 1) continue
            sendAtCmd(data)
            result = waitSendResult(5000)
            if (result == 1) break
        }
        release()
    }

    /**
     * Set the IFTTT Webhooks key used by "Send Data to IFTTT"
     */
    //% block="Setup IFTTT|Key %key"
    //% group="IFTTT"
    //% key.defl="your Key"
    //% weight=67
    export function setupIFTTT(key: string) {
        iftttKey = key
    }

    /**
     * Send data to IFTTT
     */
    //% block="Send Data to IFTTT|Event %event|value1 %value1||value2 %value2|value3 %value3"
    //% group="IFTTT"
    //% event.defl="your Event"
    //% value1.defl="Hello"
    //% value2.defl="Calliope"
    //% value3.defl="mini"
    //% weight=65
    export function sendToIFTTT(event: string, value1: string, value2: string, value3: string) {
        acquire()
        let result = 0
        let retry = 2

        // close the previous TCP connection
        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }

        while (isWifiConnected && retry > 0) {
            retry = retry - 1;
            // establish TCP connection
            sendAtCmd("AT+CIPSTART=\"TCP\",\"maker.ifttt.com\",80")
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 2000)
            if (result == 3) continue

            let data = "GET /trigger/" + event + "/with/key/" + iftttKey
            data = data + "?value1=" + value1
            data = data + "&value2=" + value2
            data = data + "&value3=" + value3
            data = data + " HTTP/1.1"
            data = data + "\u000D\u000A"
            data = data + "User-Agent: curl/7.58.0"
            data = data + "\u000D\u000A"
            data = data + "Host: maker.ifttt.com"
            data = data + "\u000D\u000A"
            data = data + "Accept: */*"
            data = data + "\u000D\u000A"

            sendAtCmd("AT+CIPSEND=" + (data.length + 2))
            result = waitSendPrompt(2000)
            if (result != 1) continue
            sendAtCmd(data)
            result = waitSendResult(5000)
            // close the TCP connection
            // sendAtCmd("AT+CIPCLOSE")
            // waitAtResponse("OK", "ERROR", "None", 2000)
            if (result == 1) break
        }
        release()
    }

    let ThingsboardAdresse = "paminasogo.ddns.net"
    let ThingsboardPort = "9090"
    /**
      * Send data to Thingsboard
      */
    //% block="Send Data to your Thingsboard Server|Token %AccessToken|Daten_1 %Daten1||Daten_2 %Daten2|Daten_3 %Daten3|Daten_4 %Daten4|Daten_5 %Daten5|Daten_6 %Daten6|Daten_7 %Daten7|Daten_8 %Daten8"
    //% expandableArgumentMode="enabled"
    //% AccessToken.defl="API Token(Thingsboard)"
    //% group="Thingsboard"
    //% weight=40
    export function sendToThingsboard(AccessToken: string, Daten1: number = 0.0, Daten2: number = 0.0, Daten3: number = 0.0, Daten4: number = 0.0, Daten5: number = 0.0, Daten6: number = 0.0, Daten7: number = 0.0, Daten8: number = 0.0) {
        acquire()
        let result = 0
        let retry = 2

        let data: { [key: string]: number } = {
            "Daten1": Daten1,
            "Daten2": Daten2,
            "Daten3": Daten3,
            "Daten4": Daten4,
            "Daten5": Daten5,
            "Daten6": Daten6,
            "Daten7": Daten7,
            "Daten8": Daten8
        }


        // close the previous TCP connection
        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }

        const payload = JSON.stringify(data);
        const request = `POST /api/v1/${AccessToken}/telemetry HTTP/1.1\r\n` +
            `Host: ${ThingsboardAdresse}\r\n` +
            `Content-Type: application/json\r\n` +
            `Content-Length: ${payload.length}\r\n\r\n` +
            `${payload}`;

        while (isWifiConnected && retry > 0) {
            retry = retry - 1;

            sendAtCmd(`AT+CIPSTART="TCP","${ThingsboardAdresse}",${ThingsboardPort}`);
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 3000)
            if (result == 3) continue

            // sendAtCmd appends CRLF, so the announced length must include those 2 bytes.
            sendAtCmd(`AT+CIPSEND=${request.length + 2}`);
            result = waitSendPrompt(2000)
            if (result != 1) continue

            sendAtCmd(request);
            result = waitSendResult(5000)
            if (result == 1) break

            // close the previous TCP connection
            if (isWifiConnected) {
                sendAtCmd("AT+CIPCLOSE")
                waitAtResponse("OK", "ERROR", "None", 2000)
            }


        }
        release()
    }
    /**
    * Set thingsboard adress and port
    */
    //% block="Change thingsboard Server %Serveradresse|adress %Port|port"
    //% adress.defl="paminasogo.ddns.net"
    //% port.defl="9090"
    //% weight=8
    //% group="Thingsboard"
    export function setThingsboardServer(adress: string, port: string){
    ThingsboardAdresse = adress;
    ThingsboardPort = port;
    }
    
    

    /**
     * Send a raw message via TCP or UDP
     */
    //% block="Send Message|Type %type|Server %address|Port %port|Message %message"
    //% weight=70
    //% advanced=true
    export function sendMessage(type: MessageType, address: string, port: number, message: string): void {
        acquire()
        let result = 0
        let retry = 2

        // Determine protocol type
        let protocol = (type == MessageType.TCP) ? "TCP" : "UDP"

        // Close any previous connection
        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 1000)
        }

        while (isWifiConnected && retry > 0) {
            retry = retry - 1

            // Establish connection (TCP or UDP)
            sendAtCmd("AT+CIPSTART=\"" + protocol + "\",\"" + address + "\"," + port)
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 3000)
            if (result == 3) continue

            // Send data length
            sendAtCmd("AT+CIPSEND=" + message.length)
            result = waitSendPrompt(2000)
            if (result != 1) continue

            // Send actual message
            serial.writeString(message)
            result = waitSendResult(5000)

            // Close connection
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 1000)

            if (result == 1) break
        }
        release()
    }

    function waitAtResponse(target1: string, target2: string, target3: string, timeout: number) {
        let buffer = ""
        let start = input.runningTime()

        while ((input.runningTime() - start) < timeout) {
            buffer += serial.readString()

            if (buffer.includes(target1)) { log(buffer); return 1 }
            if (buffer.includes(target2)) { log(buffer); return 2 }
            if (buffer.includes(target3)) { log(buffer); return 3 }

            // 10 ms, not 100: at 115200 baud ~1100 bytes arrive in 100 ms, far more
            // than the RX buffer holds. Still yields to other fibres.
            basic.pause(10)
        }

        log(buffer + " [TIMEOUT]")
        return 0
    }

    // Wait for the module to be ready to accept a payload after AT+CIPSEND. It may answer
    // with the ">" prompt or only with "OK" - this firmware does not reliably emit ">", so
    // accepting "OK" as well is required, otherwise the payload is never written at all.
    function waitSendPrompt(timeout: number) {
        let buffer = ""
        let start = input.runningTime()

        while ((input.runningTime() - start) < timeout) {
            buffer += serial.readString()

            if (buffer.includes("ERROR") || buffer.includes("SEND FAIL")) { log(buffer); return 2 }
            if (buffer.includes(">") || buffer.includes("OK")) { log(buffer); return 1 }

            // 10 ms, not 100: at 115200 baud ~1100 bytes arrive in 100 ms, far more
            // than the RX buffer holds. Still yields to other fibres.
            basic.pause(10)
        }

        log(buffer + " [TIMEOUT]")
        return 0
    }

    // After a payload is written the module does not reliably answer "SEND OK": it may
    // report "Recv <n> bytes" and then stream the server's reply as "+IPD,<n>:...".
    // Either of those means the data reached the server, so both count as success and the
    // caller must not retry - a retry posts the value a second time.
    function waitSendResult(timeout: number) {
        let buffer = ""
        let start = input.runningTime()

        while ((input.runningTime() - start) < timeout) {
            buffer += serial.readString()

            if (buffer.includes("SEND OK") || buffer.includes("+IPD") || buffer.includes("Recv")) { log(buffer); return 1 }
            if (buffer.includes("SEND FAIL") || buffer.includes("ERROR")) { log(buffer); return 2 }

            // 10 ms, not 100: at 115200 baud ~1100 bytes arrive in 100 ms, far more
            // than the RX buffer holds. Still yields to other fibres.
            basic.pause(10)
        }

        log(buffer + " [TIMEOUT]")
        return 0
    }

    function sendAtCmd(cmd: string) {
        serial.writeString(cmd + "\u000D\u000A")
        // Not logged here: printing now would delay draining the module's reply while it
        // arrives and can overrun the RX buffer. The wait functions print both once the
        // reply is read.
        pendingCmd = cmd
    }

    // ---- debug output (ported from pxt-WiFiLive) ----
    // Debug lines go to a handler the program registers (onDebugMessage), so the extension
    // itself has no dependency on extra-serial or any other output. No handler = debug off,
    // and no debug strings are built. Lines before the built-in serial has left the USB
    // pins (setupWifi) are dropped.
    let debugHandler: (line: string) => void = undefined
    // Set once the built-in serial has left the USB pins. A handler that writes to USB
    // through a second UART (extra-serial) must not open it while the built-in serial
    // still drives USB_TX.
    let serialOffUsb = false
    // The last AT command sent, printed together with its reply.
    let pendingCmd = ""

    /**
     * Run code for every debug line (AT traffic and status messages), for
     * troubleshooting. Without this block, no debug text is built or sent.
     *
     * Do NOT write the line to the built-in serial: that port is connected to
     * the WiFi module. Use a second UART instead, e.g. the extra-serial
     * extension on the USB pins.
     */
    //% block="on WiFi debug message $line"
    //% draggableParameters="reporter"
    //% weight=60
    //% advanced=true
    export function onDebugMessage(handler: (line: string) => void) {
        debugHandler = handler
    }

    function log(reply: string) {
        if (!debugHandler) return
        if (pendingCmd.length > 0) {
            debugLine(">>" + pendingCmd)
            pendingCmd = ""
        }
        debugLine("<<" + flatten(reply))
    }

    function note(msg: string) {
        if (!debugHandler) return
        debugLine(msg)
    }

    function debugLine(msg: string) {
        if (!debugHandler || !serialOffUsb) return
        // Debug logs get copied and shared: never print passwords or keys.
        msg = hide(msg, wifiPasswd)
        msg = hide(msg, aioKey)
        msg = hide(msg, thingSpeakKey)
        msg = hide(msg, iftttKey)
        debugHandler(msg)
    }

    function hide(msg: string, secret: string): string {
        if (secret.length == 0) return msg
        return msg.split(secret).join("***")
    }

    function flatten(s: string): string {
        let out = ""
        for (let i = 0; i < s.length; i++) {
            let c = s.charAt(i)
            if (c == "\r" || c == "\n") out += " "
            else out += c
        }
        return out
    }

    /**
     * Set the Adafruit IO username and AIO Key used by the Adafruit IO blocks
     * and check them with Adafruit IO. Run "Setup Wifi" first. Check the result
     * with "Adafruit IO OK?".
     */
    //% block="Setup Adafruit IO|Username %username|AIO Key %key"
    //% group="Adafruit IO"
    //% username.defl="your Username"
    //% key.defl="your AIO Key"
    //% weight=82
    export function setupAdafruitIO(username: string, key: string) {
        aioUsername = username
        aioKey = key
        aioOk = false

        acquire()
        startConnectAnim()
        let retry = 2
        while (isWifiConnected && retry > 0 && !aioOk) {
            retry = retry - 1
            aioOk = checkAdafruitIO()
        }
        note(!isWifiConnected ? "aio: no WiFi" : aioOk ? "aio: login OK" : "aio: login FAILED")
        endConnectAnim(aioOk)
        release()
    }

    /**
     * True if "Setup Adafruit IO" could log in to Adafruit IO with the given
     * username and AIO Key.
     */
    //% block="Adafruit IO OK?"
    //% group="Adafruit IO"
    //% weight=81
    export function adafruitIOOK() {
        return aioOk
    }

    // Ask Adafruit IO for the account's rate-limit info. It is a tiny reply that needs both
    // the username (in the path) and a matching AIO Key, so "200" means both are right;
    // a wrong key gives 401/403, a wrong username 403/404. Caller holds the UART lock.
    function checkAdafruitIO(): boolean {
        clearSerialBuffer()
        sendAtCmd("AT+CIPCLOSE")
        waitAtResponse("OK", "ERROR", "None", 1000)

        sendAtCmd("AT+CIPSTART=\"TCP\",\"io.adafruit.com\",80")
        let r = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 3000)
        if (r == 0 || r == 3) return false

        let req =
            "GET /api/v2/" + aioUsername + "/throttle HTTP/1.1\r\n" +
            "Host: io.adafruit.com\r\n" +
            "X-AIO-Key: " + aioKey + "\r\n" +
            "Connection: close\r\n"
        sendAtCmd("AT+CIPSEND=" + (req.length + 2))
        if (waitSendPrompt(2000) != 1) return false
        sendAtCmd(req)

        // Wait for the status line, then for the server to close the connection so the
        // rest of the reply does not end up in front of the next command's answer.
        let buffer = ""
        // The start of the reply, for the debug log.
        let head = ""
        let status = ""
        let start = input.runningTime()
        while ((input.runningTime() - start) < 8000) {
            let chunk = serial.readString()
            // Read again at once while data is arriving; pause only when there is none,
            // so the RX buffer cannot overflow in the middle of the reply.
            if (chunk.length == 0) { basic.pause(5); continue }
            buffer += chunk
            if (head.length < 120) head += chunk
            if (status.length == 0) {
                let pos = buffer.indexOf("HTTP/1.1 ")
                if (pos >= 0 && buffer.length >= pos + 12) status = buffer.substr(pos + 9, 3)
            }
            if (buffer.includes("CLOSED")) break
            // Keep only a tail: enough to find "CLOSED" (or the status line) across chunks.
            if (buffer.length > 64) buffer = buffer.substr(buffer.length - 16)
        }
        log(head)
        note("aio: HTTP status " + (status.length > 0 ? status : "none"))
        return status == "200"
    }

    /**
     * Get the latest value of an Adafruit IO feed. Returns a number if the
     * value is a number, otherwise the text. Returns 0 if no value could be read.
     */
    //% block="Adafruit IO GET|Feed %feed"
    //% group="Adafruit IO"
    //% feed.defl="your Feed"
    //% weight=75
    export function adafruitIOGetValue(feed: string): any {
        acquire()
        clearSerialBuffer()

        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 1000)
        }

        sendAtCmd("AT+CIPSTART=\"TCP\",\"io.adafruit.com\",80")
        let result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 3000)
        if (result == 3) { release(); return 0 }

        // Built without the trailing blank line: sendAtCmd appends the CRLF that
        // terminates the headers, exactly as in adafruitIOPost, which the module accepts.
        let req =
            "GET /api/v2/" + aioUsername + "/feeds/" + feed + "/data/last HTTP/1.1\r\n" +
            "Host: io.adafruit.com\r\n" +
            "X-AIO-Key: " + aioKey + "\r\n" +
            "Connection: close\r\n"

        sendAtCmd("AT+CIPSEND=" + (req.length + 2))
        result = waitSendPrompt(2000)
        if (result != 1) { release(); return 0 }

        sendAtCmd(req)

        // Read and parse incrementally - find value ASAP
        let buffer = ""
        let start = input.runningTime()
        let lastDataTime = start
        let emptyReads = 0
        let found = ""

        while ((input.runningTime() - start) < 10000) {
            let chunk = serial.readString()
            if (chunk.length > 0) {
                buffer += chunk
                lastDataTime = input.runningTime()
                emptyReads = 0

                // Try to find value after each chunk (only if not found yet)
                if (found.length == 0) {
                    let key = "\"value\":\""
                    let pos = buffer.indexOf(key)
                    if (pos >= 0) {
                        pos += key.length
                        let end = buffer.indexOf("\"", pos)
                        if (end > pos) {
                            found = buffer.substr(pos, end - pos)
                            // Continue reading to drain buffer
                        }
                    }
                }

                // Exit if connection closed
                if (chunk.includes("CLOSED")) break
            } else {
                emptyReads++
                // Only pause after MANY empty reads
                if (emptyReads > 150) {
                    basic.pause(5)
                    emptyReads = 0
                }
                // If we found value and no new data for 500ms, return it
                if (found.length > 0 && (input.runningTime() - lastDataTime) > 500) {
                    note("aio get: " + found)
                    release()
                    return toValue(found)
                }
                // If no new data for 2 seconds, we're done
                if (buffer.length > 100 && (input.runningTime() - lastDataTime) > 2000) {
                    break
                }
            }
        }

        note("aio get: " + (found.length > 0 ? found : "no value"))
        release()
        if (found.length > 0) return toValue(found)

        return 0
    }

    // A feed value comes back as text. Hand it out as a number if it is one, so the GET
    // block fits number slots (math, "show number"); anything else stays text.
    function toValue(v: string): any {
        return isNumber(v) ? parseFloat(v) : v
    }

    // Plain decimal number: optional sign, digits, at most one ".", at least one digit.
    // Stricter than parseFloat, which would turn "12abc" into 12.
    function isNumber(v: string): boolean {
        let digits = 0
        let dots = 0
        for (let i = 0; i < v.length; i++) {
            let c = v.charAt(i)
            if (c >= "0" && c <= "9") digits++
            else if (c == ".") { dots++; if (dots > 1) return false }
            else if ((c == "-" || c == "+") && i == 0) { }
            else return false
        }
        return digits > 0
    }
    /**
        * Send value to an Adafruit IO feed (HTTP POST)
        */
    // value is "any" with a number shadow: the block shows a number by default,
    // but a text (or any other) block can be dropped in as well.
    //% block="Adafruit IO POST|Value %value|Feed %feed"
    //% group="Adafruit IO"
    //% value.shadow=math_number
    //% feed.defl="your Feed"
    //% weight=80
    export function adafruitIOPost(value: any, feed: string) {
        acquire()
        serial.readString() // dump old data
        basic.pause(20)

        let result = 0
        let retry = 2

        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 2000)
        }

        while (isWifiConnected && retry > 0) {
            retry = retry - 1

            // Drop anything left from a previous attempt (typically the tail of a "+IPD"
            // response), otherwise it is read as the answer to the command below.
            serial.readString()

            // Open TCP connection
            sendAtCmd("AT+CIPSTART=\"TCP\",\"io.adafruit.com\",80")
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 3000)
            if (result == 3) continue

            // JSON body
            let body = "{\"value\":\"" + value + "\"}"

            // Build POST request
            let data = "POST /api/v2/" + aioUsername + "/feeds/" + feed + "/data HTTP/1.1\r\n"
            data += "Host: io.adafruit.com\r\n"
            data += "X-AIO-Key: " + aioKey + "\r\n"
            data += "Content-Type: application/json\r\n"
            data += "Content-Length: " + body.length + "\r\n"
            data += "User-Agent: Calliope-Mini\r\n"
            data += "Accept: */*\r\n"
            data += "Connection: close\r\n\r\n"
            data += body

            // sendAtCmd appends CRLF, so the announced length must include those 2 bytes.
            sendAtCmd("AT+CIPSEND=" + (data.length + 2))
            result = waitSendPrompt(2000)
            if (result != 1) continue

            sendAtCmd(data)
            result = waitSendResult(5000)
            if (result == 1) {
                // "Recv"/"SEND OK" only means the module sent the request; the server's
                // answer comes after. Read it now, or it lands in the next command's wait
                // ("200 OK" matches the "OK" that AT+CIPCLOSE waits for) and every later
                // reply is read one command too late.
                drainReply(3000)
                break
            }
        }
        release()
    }
    // Read an HTTP reply to the end: until the server closes the connection ("CLOSED", the
    // requests send "Connection: close"), or nothing more arrives for 500 ms, at most
    // timeout ms. Logs the start of the reply (the status line).
    function drainReply(timeout: number) {
        let head = ""
        let tail = ""
        let start = input.runningTime()
        let last = start
        while ((input.runningTime() - start) < timeout) {
            let chunk = serial.readString()
            if (chunk.length == 0) {
                if ((input.runningTime() - last) > 500 && head.length > 0) break
                basic.pause(5)
                continue
            }
            last = input.runningTime()
            if (head.length < 120) head += chunk
            tail += chunk
            if (tail.includes("CLOSED")) break
            if (tail.length > 64) tail = tail.substr(tail.length - 16)
        }
        log(head)
    }

    function clearSerialBuffer() {
        let t = input.runningTime()
        while (input.runningTime() - t < 200) {
            serial.readString()
            basic.pause(10)
        }
    }


    export function extractAioValue(json: string): string {
        let key = "\"value\":\""
        let start = json.indexOf(key)
        if (start < 0) return ""

        start += key.length
        let end = json.indexOf("\"", start)
        if (end < 0) return ""

        return json.substr(start, end - start)
    }


}
