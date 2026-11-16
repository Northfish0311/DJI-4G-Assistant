using System;
using System.Diagnostics;
using System.Globalization;
using System.IO.Ports;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

internal static class SmsReader {
    static readonly Regex Notice = new Regex(@"^\+CMTI:\s*""(SM|ME|MT)"",\s*([0-9]{1,5})\s*$");
    static readonly Regex Inbox = new Regex(@"^\+CMGR: ""REC (?:READ|UNREAD)"",""[^""\r\n]*"",[^,\r\n]*,""[^""\r\n]+""[^\r\n]*$");
    static string Match(string text, string pattern) {
        Match m = Regex.Match(text, pattern, RegexOptions.Multiline);
        return m.Success ? m.Groups[1].Value : "";
    }
    static string Signature(Func<string,string> query) {
        string id = Match(query("AT+QCCID"), @"^\+(?:QCCID|CCID):\s*""?([0-9]{18,22})""?\s*$");
        if (id == "") return "";
        using (var sha = SHA256.Create())
            return BitConverter.ToString(sha.ComputeHash(Encoding.ASCII.GetBytes(id))).Replace("-", "").ToLowerInvariant();
    }
    // Use the same addressing as the full inbox. Never guess that slot 3 in SM is slot 3 in MT.
    static string Read(Func<string,string> query, string store, string index, string expected) {
        if (!Regex.IsMatch(expected, "^[a-f0-9]{64}$") || !Regex.IsMatch(store, "^(MT|ME|SM)$") ||
            !Regex.IsMatch(index, "^[0-9]{1,5}$") || Signature(query) != expected) return null;
        if (Match(query("AT+CPMS?"), @"^\+CPMS:\s*""(SM|ME|MT)"",") != store ||
            Match(query("AT+CMGF?"), @"^\+CMGF:\s*([01])\s*$") != "1") return null;
        string raw = query("AT+CMGR=" + index);
        int at = raw.IndexOf("+CMGR: ", StringComparison.Ordinal);
        if (at < 0) return null;
        string message = raw.Substring(at);
        int line = message.IndexOf('\n');
        if (line < 0 || !Inbox.IsMatch(message.Substring(0,line)) ||
            Regex.IsMatch(message, @"\n(?:\+CMGL:|\+CMGR:|\+CMTI:|----- )") || Signature(query) != expected) return null;
        return "+CMGL: " + index + "," + message.Substring(7);
    }
    static string Query(SerialPort port, string command) {
        port.DiscardInBuffer(); port.Write(command + "\r");
        var data = new StringBuilder(); var elapsed = Stopwatch.StartNew(); long last = 0;
        while (elapsed.ElapsedMilliseconds < 1800 && data.Length < 16384) {
            string part = port.ReadExisting();
            if (part.Length != 0) { data.Append(part); last = elapsed.ElapsedMilliseconds; }
            else if (data.Length != 0 && elapsed.ElapsedMilliseconds - last >= 80) {
                string s = data.ToString().Replace("\r", "").TrimEnd('\n');
                if (s.EndsWith("\nOK", StringComparison.Ordinal)) return s.Substring(0, s.Length - 3).Trim('\n');
                if (Regex.IsMatch(s, @"(?:^|\n)(?:ERROR|\+CM[ES] ERROR:[^\n]*)$")) throw new InvalidOperationException();
            }
            Thread.Sleep(12);
        }
        throw new TimeoutException();
    }
    static string NoticeLine(string line) {
        Match m = Notice.Match(line.Trim());
        return m.Success ? m.Groups[1].Value + ":" + Int32.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture) : null;
    }
    static int Main(string[] args) {
        Console.OutputEncoding = new UTF8Encoding(false);
        try {
            if (args.Length == 1 && args[0] == "--probe") { Console.WriteLine("sms-reader-v1"); return 0; }
            if (args.Length == 2 && args[0] == "--parse-notice") {
                string n = NoticeLine(args[1]); if (n == null) return 2; Console.WriteLine(n); return 0;
            }
            // Test transport exercises the same command sequence, without opening a COM port.
            if (args.Length == 4 && args[0] == "--fixture") {
                string record = Read(delegate(string cmd) {
                    if (Console.ReadLine() != cmd) throw new InvalidOperationException();
                    return Encoding.UTF8.GetString(Convert.FromBase64String(Console.ReadLine()));
                }, args[1], args[2], args[3]);
                if (record == null) return 2; Console.Write(record); return 0;
            }
            if ((args.Length != 2 && args.Length != 5) || !Regex.IsMatch(args[1], "^COM[0-9]{1,4}$")) return 2;
            using (var port = new SerialPort(args[1], 115200, Parity.None, 8, StopBits.One)) {
                port.ReadTimeout = 150; port.WriteTimeout = 500; port.Open();
                if (args.Length == 2 && args[0] == "diagnose") {
                    string format = Match(Query(port, "AT+CMGF?"), @"^\+CMGF:\s*([01])\s*$");
                    string store = Match(Query(port, "AT+CPMS?"), @"^\+CPMS:\s*""(SM|ME|MT)"",");
                    string notice = Match(Query(port, "AT+CNMI?"), @"^\+CNMI:\s*([0-9, ]+)\s*$");
                    Console.WriteLine("format={0};readStore={1};CNMI={2}", format, store, notice);
                    return format != "" && store != "" && notice != "" ? 0 : 2;
                }
                if (args.Length == 5 && args[0] == "read") {
                    string s = Read(cmd => Query(port, cmd), args[2], args[3], args[4]);
                    if (s == null) return 2; Console.Write(s); return 0;
                }
                if (args[0] != "watch") return 2;
                var watch = Stopwatch.StartNew(); var line = new StringBuilder(); bool overflow = false;
                while (watch.ElapsedMilliseconds < 8000) {
                    foreach (char c in port.ReadExisting()) {
                        if (c == '\r' || c == '\n') {
                            string n = overflow ? null : NoticeLine(line.ToString()); line.Clear(); overflow = false;
                            if (n != null) { Console.WriteLine(n); return 0; }
                        } else if (line.Length < 128) line.Append(c); else overflow = true;
                    }
                    Thread.Sleep(40);
                }
                return 0;
            }
        } catch { return 2; }
    }
}
