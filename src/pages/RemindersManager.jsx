import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReminderManager from '../components/reminders/ReminderManager';
import ReminderSettings from '../components/reminders/ReminderSettings';
import BackButton from '../components/shared/BackButton';
import { Bell } from 'lucide-react';

export default function RemindersManager() {
  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Reminder Manager
          </h1>
          <p className="text-base lg:text-lg text-primary font-medium">
            Manage automatic reminders for rental returns and borrowed items
          </p>
        </div>

        <Tabs defaultValue="reminders" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reminders">Active Reminders</TabsTrigger>
            <TabsTrigger value="settings">Reminder Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="reminders" className="mt-6">
            <ReminderManager />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <ReminderSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}