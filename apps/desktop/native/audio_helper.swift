// audio_helper — tiny CoreAudio CLI used by MeetCommand.
//
// We need to list the system's input + output audio devices and switch the
// system default. Pure JS / osascript can't do that on macOS — there's no
// shell built-in for it. CoreAudio is the right layer, but binding it from
// Node would mean shipping a native module. A 3kB Swift binary built once at
// install time is simpler.
//
// Commands (one per invocation):
//   list-input                     -> JSON [{id, name}]
//   list-output                    -> JSON [{id, name}]
//   get-default-input              -> "Device Name"
//   get-default-output             -> "Device Name"
//   set-default-input  <name>      -> "ok" / "not found"
//   set-default-output <name>      -> "ok" / "not found"

import Foundation
import CoreAudio

@inline(__always)
func sys() -> AudioObjectID { AudioObjectID(kAudioObjectSystemObject) }

func allDeviceIDs() -> [AudioDeviceID] {
    var size: UInt32 = 0
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    guard AudioObjectGetPropertyDataSize(sys(), &addr, 0, nil, &size) == noErr else { return [] }
    let count = Int(size) / MemoryLayout<AudioDeviceID>.size
    var ids = [AudioDeviceID](repeating: 0, count: count)
    guard AudioObjectGetPropertyData(sys(), &addr, 0, nil, &size, &ids) == noErr else { return [] }
    return ids
}

func deviceName(_ id: AudioDeviceID) -> String {
    var size: UInt32 = UInt32(MemoryLayout<CFString?>.size)
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioObjectPropertyName,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var name: CFString = "" as CFString
    let status = AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &name)
    if status != noErr { return "Unknown" }
    return name as String
}

func deviceHasStreams(_ id: AudioDeviceID, scope: AudioObjectPropertyScope) -> Bool {
    var size: UInt32 = 0
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreams,
        mScope: scope,
        mElement: kAudioObjectPropertyElementMain
    )
    guard AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size) == noErr else { return false }
    return size > 0
}

func defaultDevice(input: Bool) -> AudioDeviceID {
    var id: AudioDeviceID = 0
    var size: UInt32 = UInt32(MemoryLayout<AudioDeviceID>.size)
    var addr = AudioObjectPropertyAddress(
        mSelector: input ? kAudioHardwarePropertyDefaultInputDevice : kAudioHardwarePropertyDefaultOutputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    AudioObjectGetPropertyData(sys(), &addr, 0, nil, &size, &id)
    return id
}

func setDefaultDevice(input: Bool, id: AudioDeviceID) -> Bool {
    var deviceID = id
    var addr = AudioObjectPropertyAddress(
        mSelector: input ? kAudioHardwarePropertyDefaultInputDevice : kAudioHardwarePropertyDefaultOutputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    let size = UInt32(MemoryLayout<AudioDeviceID>.size)
    return AudioObjectSetPropertyData(sys(), &addr, 0, nil, size, &deviceID) == noErr
}

func devicesFor(scope: AudioObjectPropertyScope) -> [(id: AudioDeviceID, name: String)] {
    return allDeviceIDs()
        .filter { deviceHasStreams($0, scope: scope) }
        .map { ($0, deviceName($0)) }
}

func emitJSON(_ devices: [(id: AudioDeviceID, name: String)]) {
    let arr = devices.map { ["id": "\($0.id)", "name": $0.name] }
    if let data = try? JSONSerialization.data(withJSONObject: arr),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    } else {
        print("[]")
    }
}

let args = CommandLine.arguments
guard args.count >= 2 else {
    print("usage: audio_helper <command> [args]")
    exit(1)
}

switch args[1] {
case "list-input":
    emitJSON(devicesFor(scope: kAudioDevicePropertyScopeInput))
case "list-output":
    emitJSON(devicesFor(scope: kAudioDevicePropertyScopeOutput))
case "get-default-input":
    print(deviceName(defaultDevice(input: true)))
case "get-default-output":
    print(deviceName(defaultDevice(input: false)))
case "set-default-input", "set-default-output":
    let isInput = args[1] == "set-default-input"
    guard args.count >= 3 else { print("missing name"); exit(1) }
    let target = args[2]
    let scope: AudioObjectPropertyScope = isInput ? kAudioDevicePropertyScopeInput : kAudioDevicePropertyScopeOutput
    if let match = devicesFor(scope: scope).first(where: { $0.name == target }) {
        if setDefaultDevice(input: isInput, id: match.id) { print("ok") }
        else { print("set failed"); exit(1) }
    } else {
        print("not found")
        exit(1)
    }
default:
    print("unknown command \(args[1])")
    exit(1)
}
