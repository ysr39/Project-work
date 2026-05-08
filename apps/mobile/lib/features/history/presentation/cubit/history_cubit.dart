import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../rider/domain/entities/trip_entity.dart';
import '../../domain/repositories/history_repository.dart';

part 'history_state.dart';

class HistoryCubit extends Cubit<HistoryState> {
  final HistoryRepository _repo;
  HistoryCubit(this._repo) : super(HistoryInitial());

  Future<void> load() async {
    emit(HistoryLoading());
    final result = await _repo.getHistory();
    if (result.failure != null) {
      emit(HistoryError(result.failure!.message));
    } else {
      emit(HistoryLoaded(result.trips!));
    }
  }
}
