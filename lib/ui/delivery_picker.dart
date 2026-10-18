import 'package:flutter/cupertino.dart';

import '../models.dart';
import 'kit.dart';

/// Two rows: who carries it (our driver in Muscat/Barka, or Genacom), then,
/// for Genacom, door delivery or pickup at their office. Nool is no longer
/// offered (older orders keep it).
class DeliveryPicker extends StatelessWidget {
  const DeliveryPicker({super.key, required this.value, required this.onChanged});

  final DeliveryMethod value;
  final ValueChanged<DeliveryMethod> onChanged;

  @override
  Widget build(BuildContext context) {
    final carrier = value.carrier;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Segments<Carrier>(
          value: carrier,
          options: {
            for (final c in Carrier.values)
              if (c != Carrier.nool || carrier == Carrier.nool) c: c.label
          },
          onChanged: (c) =>
              onChanged(deliveryMethodOf(c, branch: value.toBranch)),
        ),
        if (carrier != Carrier.own)
          Segments<bool>(
            value: value.toBranch,
            options: const {false: 'لباب البيت', true: 'من مكتبهم'},
            onChanged: (b) => onChanged(deliveryMethodOf(carrier, branch: b)),
          ),
      ],
    );
  }
}
