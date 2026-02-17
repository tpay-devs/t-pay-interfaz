import { Clock, CalendarX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklySchedule } from '@/utils/scheduleHelpers';

interface RestaurantClosedScreenProps {
  restaurantName: string;
  schedule: WeeklySchedule[];
  nextOpenTime: string | null;
  closureReason: string | null;
  primaryColor?: string;
}

export default function RestaurantClosedScreen({
  restaurantName,
  schedule,
  nextOpenTime,
  closureReason,
  primaryColor = '#ea580c',
}: RestaurantClosedScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        <Card className="border-2 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <CalendarX
                  className="w-10 h-10"
                  style={{ color: primaryColor }}
                />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">
              Restaurante Cerrado
            </CardTitle>
            <p className="text-lg text-gray-600 mt-2">{restaurantName}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {closureReason && (
              <div
                className="p-4 rounded-lg text-center"
                style={{ backgroundColor: `${primaryColor}10` }}
              >
                <p
                  className="font-medium"
                  style={{ color: primaryColor }}
                >
                  {closureReason}
                </p>
              </div>
            )}

            {nextOpenTime && (
              <div className="text-center">
                <p className="text-gray-700 mb-2">Próxima apertura:</p>
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-semibold"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Clock className="w-5 h-5" />
                  {nextOpenTime}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {schedule.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: primaryColor }} />
                Horarios de Atención
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {schedule.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="flex justify-between items-center py-3 border-b last:border-b-0"
                  >
                    <span className="font-medium text-gray-700 min-w-[120px]">
                      {day.dayName}
                    </span>
                    {day.isClosed ? (
                      <span className="text-gray-500 italic">Cerrado</span>
                    ) : (
                      <span className="text-gray-900 font-mono">
                        {day.openTime} - {day.closeTime}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-gray-500">
          <p>
            Los horarios pueden variar durante días festivos o eventos especiales.
          </p>
          <p className="mt-1">
            Para más información, contacta directamente con el restaurante.
          </p>
        </div>
      </div>
    </div>
  );
}
