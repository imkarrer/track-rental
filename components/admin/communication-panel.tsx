"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

type Communication = {
  id: string
  channel: string
  direction: string
  toEmail?: string | null
  toPhone?: string | null
  subject?: string | null
  body: string
  status: string
  providerId?: string | null
  createdAt: string
}

export function CommunicationPanel({
  bookingId,
  defaultEmail,
  defaultPhone,
}: {
  bookingId: string
  defaultEmail?: string
  defaultPhone?: string
}) {
  const [logs, setLogs] = useState<Communication[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [channel, setChannel] = useState<"email" | "sms">("email")
  const [toEmail, setToEmail] = useState(defaultEmail || "")
  const [toPhone, setToPhone] = useState(defaultPhone || "")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [overrideEmailOptOut, setOverrideEmailOptOut] = useState(false)
  const [overrideSmsOptIn, setOverrideSmsOptIn] = useState(false)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/communications`)
      const data = await res.json()
      setLogs(data.communications || [])
    } catch (err) {
      console.error("Error loading communications:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const sendMessage = async () => {
    setSending(true)
    try {
      const payload: any = {
        channel,
        body,
      }
      if (channel === "email") {
        payload.toEmail = toEmail
        payload.subject = subject
        payload.overrideEmailOptOut = overrideEmailOptOut
      } else {
        payload.toPhone = toPhone
        payload.overrideSmsOptIn = overrideSmsOptIn
      }
      const res = await fetch(`/api/admin/bookings/${bookingId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Failed to send")
      } else {
        setSubject("")
        setBody("")
        await loadLogs()
      }
    } catch (err) {
      console.error("Error sending communication:", err)
      alert("Failed to send")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <label className="text-sm font-medium">Channel</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={channel === "email" ? "default" : "outline"}
                onClick={() => setChannel("email")}
              >
                Email
              </Button>
              <Button
                type="button"
                variant={channel === "sms" ? "default" : "outline"}
                onClick={() => setChannel("sms")}
              >
                SMS
              </Button>
            </div>
          </div>
          {channel === "email" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">To (email)</label>
                <Input value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="overrideEmailOptOut"
                  checked={overrideEmailOptOut}
                  onChange={(e) => setOverrideEmailOptOut(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="overrideEmailOptOut" className="text-sm text-gray-700">
                  Override email opt-out
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">To (phone)</label>
                <Input value={toPhone} onChange={(e) => setToPhone(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="overrideSmsOptIn"
                  checked={overrideSmsOptIn}
                  onChange={(e) => setOverrideSmsOptIn(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="overrideSmsOptIn" className="text-sm text-gray-700">
                  Override SMS opt-in
                </label>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Type the message to send"
            />
          </div>
          <Button onClick={sendMessage} disabled={sending || !body.trim()}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">History</h4>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-500">No communications yet.</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {log.channel.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">• {log.status}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {log.toEmail && <div>To: {log.toEmail}</div>}
                    {log.toPhone && <div>To: {log.toPhone}</div>}
                    {log.subject && <div>Subject: {log.subject}</div>}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

