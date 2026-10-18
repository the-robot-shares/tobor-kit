import SwiftUI
import ToborKitCore

/// The robot avatar — a state machine over exactly the seven canonical
/// ``GuideState`` values, driven by the SSE `state` events. No client-side
/// state inference: that is the rule that keeps this surface byte-identical
/// in behavior to the web one.
public struct RobotAvatarView: View {

    public let renderer: RobotRenderer
    public let state: GuideState
    public let hint: StateAnimation
    public let reducedMotion: ReducedMotionPolicy
    public let theme: ToborTheme

    /// The accessibility reduce-motion setting, read through SwiftUI so it
    /// works on both iOS (`UIAccessibility`) and macOS (`NSWorkspace`) without
    /// this file importing either.
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    public init(
        renderer: RobotRenderer,
        state: GuideState,
        animation: StateAnimation = StateAnimation(),
        reducedMotion: ReducedMotionPolicy = .respect,
        theme: ToborTheme = .default
    ) {
        self.renderer = renderer
        self.state = state
        self.hint = animation
        self.reducedMotion = reducedMotion
        self.theme = theme
    }

    /// `respect` defers to the accessibility reduce-motion setting;
    /// `force_static` never animates; `ignore` animates regardless (not for
    /// consumer-facing apps, per the schema, but it is a contract value).
    public var motionAllowed: Bool {
        switch reducedMotion {
        case .forceStatic: return false
        case .ignore: return true
        case .respect: return !systemReduceMotion
        }
    }

    public var body: some View {
        switch renderer {
        case .glyph:
            GlyphRobotView(
                state: state,
                speed: hint.speed,
                motionAllowed: motionAllowed,
                theme: theme
            )
        case .lottie:
            // Stub until art lands: renders through the same state interface.
            // Swapping in a Lottie player must not touch any call site.
            PlaceholderRobotView(state: state, kind: "lottie", theme: theme)
        case .sprite:
            PlaceholderRobotView(state: state, kind: "sprite", theme: theme)
        }
    }
}

// MARK: - Glyph renderer (the dependency-free one — fully implemented)

/// A robot face drawn entirely with SwiftUI shapes. No assets, no packages.
///
/// Each state has a distinct, readable configuration of eyes and mouth; with
/// motion allowed the mouth waves while speaking, dots orbit while thinking,
/// and the face blinks while idle. Reduced motion freezes to the state's
/// static frame — the same face, minus the animation.
struct GlyphRobotView: View {

    let state: GuideState
    let speed: Double
    let motionAllowed: Bool
    let theme: ToborTheme

    var body: some View {
        Group {
            if motionAllowed {
                TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
                    glyph(at: timeline.date.timeIntervalSinceReferenceDate)
                }
            } else {
                glyph(at: 0)
            }
        }
        .accessibilityLabel(Text(state.label))
        .accessibilityAddTraits(.isImage)
    }

    private func glyph(at time: TimeInterval) -> some View {
        let phase = time * (speed > 0 ? speed : 0)
        return GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            ZStack {
                head(side: side)
                eyes(side: side, phase: phase)
                mouth(side: side, phase: phase)
                if state == .error { errorMark(side: side) }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .opacity(state == .offline ? 0.45 : 1)
        }
        .aspectRatio(1, contentMode: .fit)
    }

    private var faceColor: Color {
        switch state {
        case .error: return .red
        case .offline: return theme.surfaceAlt
        default: return theme.accent
        }
    }

    private func head(side: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: side * 0.22, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [faceColor.opacity(0.24), faceColor.opacity(0.10)],
                    startPoint: .top, endPoint: .bottom
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: side * 0.22, style: .continuous)
                    .strokeBorder(faceColor.opacity(0.65), lineWidth: side * 0.035)
            )
            // Antenna: the one element that reads "robot" at 32pt.
            .overlay(alignment: .top) {
                Capsule()
                    .fill(faceColor.opacity(0.65))
                    .frame(width: side * 0.04, height: side * 0.1)
                    .offset(y: -side * 0.09)
            }
    }

    @ViewBuilder
    private func eyes(side: CGFloat, phase: TimeInterval) -> some View {
        HStack(spacing: side * 0.18) {
            eye(side: side, phase: phase)
            eye(side: side, phase: phase)
        }
        .offset(y: -side * 0.08)
    }

    @ViewBuilder
    private func eye(side: CGFloat, phase: TimeInterval) -> some View {
        switch state {
        case .listening:
            // Widened: listening is bigger eyes.
            Circle()
                .fill(faceColor)
                .frame(width: side * 0.14, height: side * 0.14)
        case .thinking:
            // Looking up and to the side.
            Circle()
                .fill(faceColor)
                .frame(width: side * 0.09, height: side * 0.09)
                .offset(x: side * 0.02, y: -side * 0.03)
        case .error:
            XEye(side: side, color: faceColor)
        case .offline:
            // Flat closed lines.
            Capsule()
                .fill(faceColor)
                .frame(width: side * 0.13, height: side * 0.03)
        case .idle:
            // A slow blink every ~4s; static frame is the open eye.
            let blink = motionAllowed
                ? phase.truncatingRemainder(dividingBy: 4.0) > 3.85
                : false
            if blink {
                Capsule()
                    .fill(faceColor)
                    .frame(width: side * 0.13, height: side * 0.03)
            } else {
                Circle()
                    .fill(faceColor)
                    .frame(width: side * 0.11, height: side * 0.11)
            }
        case .speaking, .toolRunning:
            Circle()
                .fill(faceColor)
                .frame(width: side * 0.11, height: side * 0.11)
        }
    }

    @ViewBuilder
    private func mouth(side: CGFloat, phase: TimeInterval) -> some View {
        switch state {
        case .speaking:
            // Animated waveform mouth — three bars bouncing with the phase.
            HStack(spacing: side * 0.025) {
                ForEach(0..<3, id: \.self) { index in
                    let bounce = motionAllowed
                        ? 0.5 + 0.5 * sin(phase * 9 + Double(index) * 1.3)
                        : 0.5
                    Capsule()
                        .fill(faceColor)
                        .frame(width: side * 0.045, height: side * (0.05 + 0.08 * bounce))
                }
            }
            .offset(y: side * 0.13)
        case .thinking:
            // Three dots, cycling opacity — static frame is the middle dot lit.
            HStack(spacing: side * 0.03) {
                ForEach(0..<3, id: \.self) { index in
                    let lit = motionAllowed
                        ? Int(phase * 2.0) % 3 == index
                        : index == 1
                    Circle()
                        .fill(faceColor.opacity(lit ? 1 : 0.3))
                        .frame(width: side * 0.05, height: side * 0.05)
                }
            }
            .offset(y: side * 0.15)
        case .toolRunning:
            // A progress-arc mouth: an incomplete circle sweeping with phase.
            let sweep = motionAllowed
                ? Angle.degrees((phase * 120).truncatingRemainder(dividingBy: 360))
                : Angle.degrees(120)
            Circle()
                .trim(from: 0, to: 0.3)
                .stroke(faceColor, style: StrokeStyle(lineWidth: side * 0.04, lineCap: .round))
                .frame(width: side * 0.22, height: side * 0.22)
                .rotationEffect(sweep)
                .offset(y: side * 0.1)
        case .error:
            // Flat, unhappy line.
            Capsule()
                .fill(faceColor)
                .frame(width: side * 0.2, height: side * 0.035)
                .offset(y: side * 0.15)
        case .idle, .listening:
            // A small content line; listening opens slightly.
            Capsule()
                .fill(faceColor)
                .frame(width: side * (state == .listening ? 0.14 : 0.1), height: side * 0.035)
                .offset(y: side * 0.15)
        case .offline:
            EmptyView()
        }
    }

    @ViewBuilder
    private func errorMark(side: CGFloat) -> some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                XEye(side: side * 0.5, color: .red)
                    .padding(side * 0.08)
            }
            Spacer()
        }
    }
}

/// An X drawn from two capsules — reused for the error-state eyes and badge.
struct XEye: View {
    let side: CGFloat
    let color: Color

    var body: some View {
        ZStack {
            Capsule().frame(width: side * 0.16, height: side * 0.032).rotationEffect(.degrees(45))
            Capsule().frame(width: side * 0.16, height: side * 0.032).rotationEffect(.degrees(-45))
        }
        .foregroundStyle(color)
    }
}

/// The lottie/sprite stand-in. It shares the state interface — same input, same
/// accessibility contract — so art can land later without touching a call site.
/// It deliberately looks unfinished: a shipped app should configure `glyph`
/// until real assets exist, not mistake this for the real renderer.
struct PlaceholderRobotView: View {
    let state: GuideState
    let kind: String
    let theme: ToborTheme

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(theme.surfaceAlt.opacity(0.5))
            VStack(spacing: 4) {
                Image(systemName: "cube.transparent")
                    .font(.title3)
                    .foregroundStyle(theme.accent)
                Text("\(kind) · \(state.rawValue)")
                    .font(.system(size: 8, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityLabel(Text(state.label))
        .accessibilityAddTraits(.isImage)
    }
}
