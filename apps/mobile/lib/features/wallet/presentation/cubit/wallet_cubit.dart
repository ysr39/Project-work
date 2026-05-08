import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../domain/repositories/wallet_repository.dart';

part 'wallet_state.dart';

class WalletCubit extends Cubit<WalletState> {
  final WalletRepository _repo;
  WalletCubit(this._repo) : super(WalletInitial());

  Future<void> loadHistory() async {
    emit(WalletLoading());
    final result = await _repo.getPaymentHistory();
    if (result.failure != null) {
      emit(WalletError(result.failure!.message));
    } else {
      emit(WalletLoaded(result.history!));
    }
  }
}
