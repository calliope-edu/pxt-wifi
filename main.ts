enum MessageType {
    UDP,
    TCP
}
/**
 * Functions to operate Grove module.
 */
//% weight=10 color=#9F79EE icon="\uf1b3" block="WiFI"
//% groups='["UartWiFi"]'
namespace WiFi {
    /**
     * 
     */

    let isWifiConnected = false;
    let wifiBaudRate = BaudRate.BaudRate115200;
    /**
     * Setup Grove - Uart WiFi V2 to connect to  Wi-Fi
     */
    //% block="Setup Wifi|TX %txPin|RX %rxPin|Baud rate %baudrate|SSID = %ssid|Password = %passwd"
    //% group="UartWiFi"
    //% txPin.defl=SerialPin.C17
    //% rxPin.defl=SerialPin.C16
    //% baudRate.defl=BaudRate.BaudRate9600
    export function setupWifi(txPin: SerialPin, rxPin: SerialPin, baudRate: BaudRate, ssid: string, passwd: string) {
        let result = 0

        isWifiConnected = false
        wifiBaudRate = baudRate

        // Start with default ESP32 baud rate (115200)
        serial.redirect(
            txPin,
            rxPin,
            BaudRate.BaudRate115200
        )

        sendAtCmd("AT")
        result = waitAtResponse("OK", "ERROR", "None", 1000)

        sendAtCmd("AT+SYSSTORE=0")
        result = waitAtResponse("OK", "ERROR", "FAIL", 3000)

        // Convert BaudRate enum to number
        let baudNum = baudRate as number


        // If user wants different baud rate, configure ESP32
        if (baudNum != 115200) {
            // Set ESP32 baud rate: AT+UART_DEF=baudrate,databits,stopbits,parity,flow
            sendAtCmd("AT+UART_CUR=" + baudNum + ",8,1,0,0")
            basic.pause(100)

            // Switch Calliope to new baud rate
            serial.redirect(txPin, rxPin, baudRate)
            basic.pause(100)

            // Test new baud rate
            sendAtCmd("AT")
            result = waitAtResponse("OK", "ERROR", "None", 1000)
        }

        sendAtCmd("AT+CWMODE=1")
        result = waitAtResponse("OK", "ERROR", "None", 1000)

        sendAtCmd(`AT+CWJAP="${ssid}","${passwd}"`)
        result = waitAtResponse("WIFI GOT IP", "ERROR", "None", 20000)

        if (result == 1) {
            isWifiConnected = true
        }
    }

    /**
     * Check if Grove - Uart WiFi V2 is connected to Wifi
     */
    //% block="Wifi OK?"
    //% group="UartWiFi"
    export function wifiOK() {
        return isWifiConnected
    }

    /**
     * Send data to ThingSpeak
     */
    //% block="Send Data to your ThingSpeak Channel|Write API Key %apiKey|Field1 %field1|Field2 %field2||Field3 %field3|Field4 %field4|Field5 %field5|Field6 %field6|Field7 %field7|Field8 %field8"
    //% group="UartWiFi"
    //% expandableArgumentMode="enabled"
    //% apiKey.defl="your Write API Key"
    export function sendToThingSpeak(apiKey: string, field1: number = 0, field2: number = 0, field3: number = 0, field4: number = 0, field5: number = 0, field6: number = 0, field7: number = 0, field8: number = 0) {
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

            let data = "GET /update?api_key=" + apiKey
            if (!isNaN(field1)) data = data + "&field1=" + field1
            if (!isNaN(field2)) data = data + "&field2=" + field2
            if (!isNaN(field3)) data = data + "&field3=" + field3
            if (!isNaN(field4)) data = data + "&field4=" + field4
            if (!isNaN(field5)) data = data + "&field5=" + field5
            if (!isNaN(field6)) data = data + "&field6=" + field6
            if (!isNaN(field7)) data = data + "&field7=" + field7
            if (!isNaN(field8)) data = data + "&field8=" + field8

            sendAtCmd("AT+CIPSEND=" + (data.length + 2))
            result = waitAtResponse(">", "OK", "ERROR", 2000)
            if (result == 3) continue
            sendAtCmd(data)
            result = waitAtResponse("SEND OK", "SEND FAIL", "ERROR", 5000)
            if (result == 1) break
        }
    }

    /**
     * Send data to IFTTT
     */
    //% block="Send Data to your IFTTT Event|Event %event|Key %key|value1 %value1||value2 %value2|value3 %value3"
    //% group="UartWiFi"
    //% event.defl="your Event"
    //% key.defl="your Key"
    //% value1.defl="Hello"
    //% value2.defl="Calliope"
    //% value3.defl="mini"
    export function sendToIFTTT(event: string, key: string, value1: string, value2: string, value3: string) {
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

            let data = "GET /trigger/" + event + "/with/key/" + key
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
            result = waitAtResponse(">", "OK", "ERROR", 2000)
            if (result == 3) continue
            sendAtCmd(data)
            result = waitAtResponse("SEND OK", "SEND FAIL", "ERROR", 5000)
            // close the TCP connection
            // sendAtCmd("AT+CIPCLOSE")
            // waitAtResponse("OK", "ERROR", "None", 2000)
            if (result == 1) break
        }
    }

    /**
     * Send a raw message via TCP or UDP
     */
    //% block="Send Message|Type %type|Server %address|Port %port|Message %message"
    //% group="UartWiFi"
    //% weight=70
    //% advanced=true
    export function sendMessage(type: MessageType, address: string, port: number, message: string): void {
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
            result = waitAtResponse(">", "OK", "ERROR", 2000)
            if (result == 3) continue

            // Send actual message
            serial.writeString(message)
            result = waitAtResponse("SEND OK", "SEND FAIL", "ERROR", 5000)

            // Close connection
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 1000)

            if (result == 1) break
        }
    }

    function waitAtResponse(target1: string, target2: string, target3: string, timeout: number) {
        let buffer = ""
        let start = input.runningTime()

        while ((input.runningTime() - start) < timeout) {
            buffer += serial.readString()

            if (buffer.includes(target1)) return 1
            if (buffer.includes(target2)) return 2
            if (buffer.includes(target3)) return 3

            basic.pause(100)
        }

        return 0
    }

    function sendAtCmd(cmd: string) {
        serial.writeString(cmd + "\u000D\u000A")
    }



    // Configure these to match your hardware
    const WIFI_TX = SerialPin.C17
    const WIFI_RX = SerialPin.C16
    const DBG_TX = SerialPin.USB_TX
    const DBG_RX = SerialPin.USB_RX

    function dbg(msg: string) {
        serial.redirect(DBG_TX, DBG_RX, BaudRate.BaudRate115200)
        serial.writeLine("[DBG " + input.runningTime() + "] " + msg)
        serial.redirect(WIFI_TX, WIFI_RX, wifiBaudRate)
    }

    export function adafruitIOGetValue(feed: string, username: string, aioKey: string): string {
        clearSerialBuffer()

        if (isWifiConnected) {
            sendAtCmd("AT+CIPCLOSE")
            waitAtResponse("OK", "ERROR", "None", 1000)
        }

        sendAtCmd("AT+CIPSTART=\"TCP\",\"io.adafruit.com\",80")
        let result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 3000)
        if (result == 3) return ""

        let req =
            "GET /api/v2/" + username + "/feeds/" + feed + "/data/last HTTP/1.1\r\n" +
            "Host: io.adafruit.com\r\n" +
            "X-AIO-Key: " + aioKey + "\r\n" +
            "Connection: close\r\n\r\n"

        sendAtCmd("AT+CIPSEND=" + req.length)
        result = waitAtResponse(">", "OK", "ERROR", 2000)
        if (result == 3) return ""

        serial.writeString(req + "\r\n")

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
                            // dbg("Found: " + found + " at " + buffer.length + " bytes")
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
                    return found
                }
                // If no new data for 2 seconds, we're done
                if (buffer.length > 100 && (input.runningTime() - lastDataTime) > 2000) {
                    break
                }
            }
        }

        if (found.length > 0) return found

        // dbg("No value in " + buffer.length + " bytes")
        return ""
    }
    /**
        * Send value to an Adafruit IO feed (HTTP POST)
        */
    //% block="Adafruit IO POST|Username %username|Feed %feed|Value %value|AIO Key %aioKey"
    //% group="UartWiFi"
    export function adafruitIOPost(username: string, feed: string, value: string, aioKey: string) {
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

            // Open TCP connection
            sendAtCmd("AT+CIPSTART=\"TCP\",\"io.adafruit.com\",80")
            result = waitAtResponse("OK", "ALREADY CONNECTED", "ERROR", 3000)
            if (result == 3) continue

            // JSON body
            let body = "{\"value\":\"" + value + "\"}"

            // Build POST request
            let data = "POST /api/v2/" + username + "/feeds/" + feed + "/data HTTP/1.1\r\n"
            data += "Host: io.adafruit.com\r\n"
            data += "X-AIO-Key: " + aioKey + "\r\n"
            data += "Content-Type: application/json\r\n"
            data += "Content-Length: " + body.length + "\r\n"
            data += "User-Agent: Calliope-Mini\r\n"
            data += "Accept: */*\r\n\r\n"
            data += body

            sendAtCmd("AT+CIPSEND=" + data.length)
            result = waitAtResponse(">", "OK", "ERROR", 2000)
            if (result == 3) continue

            sendAtCmd(data)
            result = waitAtResponse("SEND OK", "SEND FAIL", "ERROR", 5000)
            if (result == 1) break
        }
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
