import SwiftUI

/// Two rows: who carries it (our driver in Muscat/Barka, or Genacom), then,
/// for Genacom, door delivery or pickup at their office. Nool is no longer
/// offered (older orders keep it). Put it inside a GHSection.
struct DeliveryPicker: View {
    let value: DeliveryMethod
    let onChanged: (DeliveryMethod) -> Void

    init(value: DeliveryMethod, onChanged: @escaping (DeliveryMethod) -> Void) {
        self.value = value
        self.onChanged = onChanged
    }

    var body: some View {
        // A Gulf order stays a Gulf shipment: only the company changes.
        if value.isGulf {
            gulfPicker
        } else {
            localPicker
        }
    }

    private var gulfOptions: [(DeliveryMethod, String)] {
        [(DeliveryMethod.gccGenacom, "جيناكم · خليجي"), (DeliveryMethod.gccDhl, "DHL · خليجي")]
    }

    private var gulfPicker: some View {
        let change = onChanged
        let binding = Binding<DeliveryMethod>(get: { value }, set: { change($0) })
        return Segments(value: binding, options: gulfOptions)
    }

    private var carrierOptions: [(Carrier, String)] {
        let current = value.carrier
        let shown = Carrier.allCases.filter { c in (c != .nool || current == .nool) && c != .dhl }
        return shown.map { c in (c, c.label) }
    }

    private var carrierBinding: Binding<Carrier> {
        let change = onChanged
        let branch = value.toBranch
        let current = value.carrier
        return Binding<Carrier>(get: { current }, set: { c in change(DeliveryMethod.of(c, branch: branch)) })
    }

    private var branchBinding: Binding<Bool> {
        let change = onChanged
        let branch = value.toBranch
        let carrier = value.carrier
        return Binding<Bool>(get: { branch }, set: { b in change(DeliveryMethod.of(carrier, branch: b)) })
    }

    private var branchOptions: [(Bool, String)] {
        [(false, "لباب البيت"), (true, "من مكتبهم")]
    }

    private var localPicker: some View {
        VStack(alignment: .leading, spacing: 0) {
            Segments(value: carrierBinding, options: carrierOptions)
            if value.carrier != .own {
                Segments(value: branchBinding, options: branchOptions)
            }
        }
        .frame(maxWidth: .infinity)
    }
}
