import 'package:flutter_test/flutter_test.dart';
import 'package:gh_shopper/format.dart';

void main() {
  test('Arabic digits parse as numbers', () {
    expect(parseAmount('١٢٫٥'), 12.5);
    expect(parseAmount('45,250'), 45.25);
    expect(parseAmount(''), isNull);
  });

  test('Omani numbers get the country code', () {
    expect(waPhone('9123 4567'), '96891234567');
    expect(waPhone('+968 9123 4567'), '96891234567');
    expect(waPhone('0096891234567'), '96891234567');
  });
}
