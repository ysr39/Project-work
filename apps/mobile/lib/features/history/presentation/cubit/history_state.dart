part of 'history_cubit.dart';

sealed class HistoryState extends Equatable {
  @override List<Object?> get props => [];
}
final class HistoryInitial extends HistoryState {}
final class HistoryLoading extends HistoryState {}
final class HistoryLoaded extends HistoryState {
  final List<TripEntity> trips;
  const HistoryLoaded(this.trips);
  @override List<Object?> get props => [trips];
}
final class HistoryError extends HistoryState {
  final String message;
  const HistoryError(this.message);
  @override List<Object?> get props => [message];
}
