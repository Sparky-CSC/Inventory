import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReminderSettings as ReminderSettingsEntity } from '@/entities/ReminderSettings';
import { Settings, Save } from 'lucide-react';
import { createDefaultReminderSettings } from '@/lib/reminders';

export default function ReminderSettings() {
  const [settings, setSettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settingsData = await ReminderSettingsEntity.list();
      
      // If no settings exist, create defaults
      if (settingsData.length === 0) {
        await createDefaultSettings();
      } else {
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Failed to load reminder settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      setSettings(await createDefaultReminderSettings());
    } catch (error) {
      console.error('Failed to create default settings:', error);
    }
  };

  const updateSetting = (id, field, value) => {
    setSettings(prev => 
      prev.map(setting => 
        setting.id === id ? { ...setting, [field]: value } : setting
      )
    );
  };

  const saveSetting = async (setting) => {
    setIsSaving(true);
    try {
      await ReminderSettingsEntity.update(setting.id, setting);
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveAllSettings = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        settings.map(setting => ReminderSettingsEntity.update(setting.id, setting))
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const rentalSettings = settings.filter(s => s.entity_type === 'rental_order');
  const borrowedSettings = settings.filter(s => s.entity_type === 'borrowed_item');

  // A render helper rather than a component, so typing in a template field keeps its focus.
  const renderSettingCard = ({ setting, title }) => (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <Switch
            checked={setting.is_enabled}
            onCheckedChange={(checked) => updateSetting(setting.id, 'is_enabled', checked)}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Days Before Due Date</Label>
            <Input
              type="number"
              value={setting.days_before_due}
              onChange={(e) => updateSetting(setting.id, 'days_before_due', parseInt(e.target.value))}
              placeholder="3 (use negative for overdue)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Positive = days before due date, Negative = days after due date
            </p>
          </div>
          <div>
            <Label>Staff Email (optional)</Label>
            <Input
              type="email"
              value={setting.staff_email || ''}
              onChange={(e) => updateSetting(setting.id, 'staff_email', e.target.value)}
              placeholder="staff@example.com"
            />
          </div>
        </div>
        
        <div>
          <Label>Email Subject</Label>
          <Input
            value={setting.email_template_subject}
            onChange={(e) => updateSetting(setting.id, 'email_template_subject', e.target.value)}
          />
        </div>
        
        <div>
          <Label>Email Body</Label>
          <Textarea 
            value={setting.email_template_body}
            onChange={(e) => updateSetting(setting.id, 'email_template_body', e.target.value)}
            rows={8}
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-gray-500">
            <p><strong>Available placeholders:</strong></p>
            <p>
              {setting.entity_type === 'rental_order' 
                ? '{order_number}, {renter_name}, {due_date}, {items}'
                : '{item_name}, {lender_name}, {due_date}, {borrowed_date}'
              }
            </p>
          </div>
          <Button 
            onClick={() => saveSetting(setting)}
            disabled={isSaving}
            variant="outline"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Settings...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Reminder Settings
            </span>
            <Button onClick={saveAllSettings} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Save All Settings
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="rentals">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rentals">Rental Reminders</TabsTrigger>
              <TabsTrigger value="borrowed">Borrowed Item Reminders</TabsTrigger>
            </TabsList>
            
            <TabsContent value="rentals" className="mt-6">
              {rentalSettings.map(setting => (
                <React.Fragment key={setting.id}>
                  {renderSettingCard({ setting, title: setting.reminder_type === 'return_due' ? 'Return Due Reminder' : 'Overdue Reminder' })}
                </React.Fragment>
              ))}
            </TabsContent>
            
            <TabsContent value="borrowed" className="mt-6">
              {borrowedSettings.map(setting => (
                <React.Fragment key={setting.id}>
                  {renderSettingCard({ setting, title: setting.reminder_type === 'return_due' ? 'Return Due Reminder' : 'Overdue Reminder' })}
                </React.Fragment>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}