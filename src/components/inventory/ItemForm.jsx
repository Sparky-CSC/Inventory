import React, { useState, useEffect, useMemo } from "react";
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Container } from "@/entities/Container";
import { Location } from "@/entities/Location";
import { Category } from "@/entities/Category";
import { Subcategory } from "@/entities/Subcategory";
import { UploadFile } from "@/integrations/Core";
import { generateItemUid } from "@/lib/itemCodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";


import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Plus, AlertCircle, Info,
  Upload, Image, Trash2, ChevronsUpDown,
  Shirt, Drama, Hammer, Lightbulb, Package, Star, Fingerprint, Scan, Armchair, Loader2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCodeGenerator from '../shared/QRCodeGenerator';
import BarcodeScanner from './BarcodeScanner';
import ItemQRScanner from './ItemQRScanner';
import { getAppUrl } from '@/utils';

const timePeriodOptions = [
  "Ancient", "Medieval (500-1500)", "Renaissance (1400-1600)", "Baroque (1600-1750)",
  "Colonial (1600-1800)", "Georgian (1714-1830)", "Victorian (1837-1901)", "Edwardian (1901-1910)",
  "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s",
  "Contemporary", "Futuristic", "Fantasy", "Timeless"
];

const styleOptions = [
  "Classical", "Gothic", "Renaissance", "Baroque", "Rococo", "Neoclassical", "Romantic",
  "Art Nouveau", "Art Deco", "Modernist", "Minimalist", "Contemporary", "Avant-garde",
  "Folk", "Ethnic", "Military", "Religious", "Ceremonial", "Casual", "Formal",
  "Fantasy", "Steampunk", "Post-apocalyptic"
];

const categoryOptions = [
    { value: "costume", label: "Costume", icon: Shirt },
    { value: "prop", label: "Prop", icon: Drama },
    { value: "scenery", label: "Scenery", icon: Package },
    { value: "equipment", label: "Equipment", icon: Hammer },
    { value: "fabric", label: "Fabric", icon: Shirt },
    { value: "accessory", label: "Accessory", icon: Star },
    { value: "lighting", label: "Lighting", icon: Lightbulb },
    { value: "sound", label: "Sound", icon: Package },
    { value: "furniture", label: "Furniture", icon: Armchair }
];

const conditionOptions = [
  { value: "excellent", label: "Excellent", color: "text-green-600" },
  { value: "good", label: "Good", color: "text-green-600" },
  { value: "fair", label: "Fair", color: "text-yellow-600" },
  { value: "poor", label: "Poor", color: "text-orange-600" },
  { value: "needs_repair", label: "Needs Repair", color: "text-red-600" }
];

const statusOptions = [
  { value: "available", label: "Available" },
  { value: "in_use", label: "In Use" },
  { value: "rented", label: "Rented" },
  { value: "maintenance", label: "Maintenance" },
  { value: "retired", label: "Retired" }
];

const emptyFormState = {
  name: "", description: "", categories: [], subcategory: "", condition: "good",
  size: "", measurements: { chest: "", waist: "", hips: "", inseam: "", sleeve: "", neck: "", shoulder: "" },
  dimensions: "", color: "", material: "", time_period: "", style: "", model_number: "", serial_number: "",
  uid: "", qr_code: "",
  parts: [], production_history: [], location: "", container_id: "", value: "", rental_rate: "",
  notes: "", status: "available", acquisition_date: "", last_cleaned: "",
  quantity: 1,
  variants: [],
};

// New UIDs use the shared generator (random, no look-alike letters).
const generateUID = (category = 'GEN') => generateItemUid(category);

export default function ItemForm({ item: initialData, onSubmit, onCancel }) {
  const [containers, setContainers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [photos, setPhotos] = useState(initialData?.photos || []);
  const [uploadingPhotos, setUploadingPhotos] = useState([]);
  const [currentRental, setCurrentRental] = useState(initialData?.current_rental || null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [showAddContainerDialog, setShowAddContainerDialog] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showAddSubcategoryDialog, setShowAddSubcategoryDialog] = useState(false);
  const [newLocationData, setNewLocationData] = useState({ name: '', location_type: 'room', parent_location_id: '' });
  const [newContainerData, setNewContainerData] = useState({ name: '', container_type: 'box', location: '' });
  const [newCategoryData, setNewCategoryData] = useState({ name: '', description: '', icon_name: 'Package', color: '#6B7280' });
  const [newSubcategoryData, setNewSubcategoryData] = useState({ name: '', description: '', category_name: '' });
  const [isSavingSubEntity, setIsSavingSubEntity] = useState(false);

  const isEditing = !!initialData?.id;

  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: useMemo(() => ({
      ...emptyFormState,
      ...(initialData || {}),
      measurements: initialData?.measurements || emptyFormState.measurements,
      categories: initialData?.categories || [],
      parts: initialData?.parts || [],
      value: initialData?.value?.toString() || "",
      rental_rate: initialData?.rental_rate?.toString() || "",
      container_id: initialData?.container_id || "",
      quantity: initialData?.quantity || 1,
      uid: initialData?.uid || generateUID(initialData?.categories?.[0] || initialData?.category || 'GEN'),
      production_history: initialData?.production_history || [],
      variants: initialData?.variants || [],
    }), [initialData])
  });

  const { fields: productionFields, append: appendProduction, remove: removeProduction } = useFieldArray({ control, name: 'production_history' });
  const { fields: partFields, append: appendPart, remove: removePart } = useFieldArray({ control, name: 'parts' });
  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({ control, name: 'variants' });

  const watchedCategories = watch('categories');
  const watchedUID = watch('uid');
  const watchedQRCode = watch('qr_code');
  const watchedQuantity = watch('quantity');
  const watchedVariants = watch('variants');

  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadSupportData();
    if (initialData) {
      setValue('uid', initialData.uid || generateUID(initialData.categories?.[0] || 'GEN'));
      setValue('qr_code', initialData.qr_code);
    }
  }, [initialData, setValue]);

  const loadSupportData = async () => {
    try {
      const [containersData, locationsData, categoriesData, subcategoriesData] = await Promise.all([
        Container.list(),
        Location.list(),
        Category.list(),
        Subcategory.list()
      ]);
      setContainers(containersData);
      setLocations(locationsData);
      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
    } catch (error) {
      console.error('Error loading support data:', error);
    }
  };

  const handleSaveNewLocation = async (e) => {
    e.preventDefault();
    setIsSavingSubEntity(true);
    try {
      await Location.create({
        ...newLocationData,
        parent_location_id: newLocationData.parent_location_id || null
      });
      await loadSupportData();
      setShowAddLocationDialog(false);
      setNewLocationData({ name: '', location_type: 'room', parent_location_id: '' });
    } catch (err) {
      console.error("Failed to create location", err);
      setError(`Failed to create location: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingSubEntity(false);
    }
  };

  const handleSaveNewContainer = async (e) => {
    e.preventDefault();
    setIsSavingSubEntity(true);
    try {
      await Container.create(newContainerData);
      await loadSupportData();
      setShowAddContainerDialog(false);
      setNewContainerData({ name: '', container_type: 'box', location: '' });
    } catch (err) {
      console.error("Failed to create container", err);
      setError(`Failed to create container: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingSubEntity(false);
    }
  };

  const handleSaveNewCategory = async (e) => {
    e.preventDefault();
    setIsSavingSubEntity(true);
    try {
      await Category.create(newCategoryData);
      await loadSupportData();
      setShowAddCategoryDialog(false);
      setNewCategoryData({ name: '', description: '', icon_name: 'Package', color: '#6B7280' });
    } catch (err) {
      console.error("Failed to create category", err);
      setError(`Failed to create category: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingSubEntity(false);
    }
  };

  const handleSaveNewSubcategory = async (e) => {
    e.preventDefault();
    setIsSavingSubEntity(true);
    try {
      await Subcategory.create(newSubcategoryData);
      await loadSupportData();
      setShowAddSubcategoryDialog(false);
      setNewSubcategoryData({ name: '', description: '', category_name: '' });
    } catch (err) {
      console.error("Failed to create subcategory", err);
      setError(`Failed to create subcategory: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingSubEntity(false);
    }
  };

  const handleBarcodeData = (extractedData) => {
    // The scanned code itself becomes the item's QR / barcode value …
    if (extractedData.scanned_code) {
      setValue('qr_code', extractedData.scanned_code);
    }
    // … and anything else that was found fills the matching fields.
    ['name', 'description', 'subcategory', 'material', 'dimensions', 'time_period', 'style', 'model_number', 'serial_number']
      .forEach((key) => {
        if (extractedData[key]) {
          setValue(key, extractedData[key], { shouldDirty: true });
        }
      });
    if (extractedData.category) {
      setValue('categories', [extractedData.category], { shouldDirty: true });
    }
    setShowBarcodeScanner(false);
  };

  const handleQRCodeAssigned = (qrData) => {
    setValue('qr_code', qrData);
    setShowQRScanner(false);
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploadingPhotos(files.map(f => f.name));

    try {
      for (const file of files) {
        const { file_url } = await UploadFile({ file });
        const newPhoto = {
          url: file_url,
          caption: "",
          is_primary: photos.length === 0,
          upload_date: new Date().toISOString().split('T')[0]
        };
        setPhotos(prev => [...prev, newPhoto]);
      }
    } catch (error) {
      setError("Failed to upload photos");
    } finally {
      setUploadingPhotos([]);
      e.target.value = '';
    }
  };

  const handlePhotoUpdate = (index, field, value) => {
    setPhotos(prev => prev.map((photo, i) =>
      i === index ? { ...photo, [field]: value } : photo
    ));
  };

  const handlePhotoDelete = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimaryPhoto = (index) => {
    setPhotos(prev => prev.map((photo, i) => ({
      ...photo,
      is_primary: i === index
    })));
  };

  const submitHandler = async (data) => {
    setIsSaving(true);
    setError("");

    try {
      const totalQuantity = data.variants.length > 0
        ? data.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
        : Number(data.quantity) || 1;

      let finalUID = data.uid;
      if (!finalUID) {
        const primaryCategory = data.categories?.[0] || 'GEN';
        finalUID = generateUID(primaryCategory);
      }

      const itemData = {
        ...data,
        uid: finalUID,
        value: data.value ? parseFloat(data.value) : null,
        rental_rate: data.rental_rate ? parseFloat(data.rental_rate) : null,
        photos,
        current_rental: currentRental,
        quantity: totalQuantity,
      };

      await onSubmit(itemData);

    } catch (error) {
      setError(`Failed to save item. ${error.message}`);
      console.error('Error saving item:', error);
    }
    setIsSaving(false);
  };

  const allCategoryOptions = useMemo(() => {
    const existingCategoryNames = new Set(categoryOptions.map(c => c.value));
    const dynamicCategories = categories.filter(cat =>
      cat.is_active && !existingCategoryNames.has(cat.name.toLowerCase().replace(/\s+/g, '_'))
    ).map(cat => ({
      value: cat.name.toLowerCase().replace(/\s+/g, '_'),
      label: cat.name,
      icon: Package
    }));
    return [...categoryOptions, ...dynamicCategories];
  }, [categories]);

  const filteredSubcategories = useMemo(() => {
    const selectedCats = watchedCategories || [];
    const allSubcatNames = new Set();
    const uniqueSubcategories = [];

    subcategories.forEach(sub => {
      if (sub.is_active) {
        if (selectedCats.length === 0 || selectedCats.some(cat =>
            sub.category_name?.toLowerCase() === cat.toLowerCase() ||
            sub.category_name?.toLowerCase() === cat.toLowerCase().replace(/_/g, ' ')
        )) {
          if (!allSubcatNames.has(sub.name)) {
            uniqueSubcategories.push(sub);
            allSubcatNames.add(sub.name);
          }
        }
      }
    });
    return uniqueSubcategories;
  }, [subcategories, watchedCategories]);

  // An item's QR code is its own code if one was assigned, otherwise a link to its page.
  const itemUrl = watchedQRCode
    || (initialData?.id
      ? getAppUrl(`ItemDetails?id=${initialData.id}${watchedUID ? `&uid=${watchedUID}` : ''}`)
      : '');
  const isCostumeCategorySelected = watchedCategories?.includes('costume');

  return (
    <div className="bg-base-100 rounded-xl shadow-lg border border-base-300">
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">
                {isEditing ? 'Edit Item' : 'Add Item'}
              </h1>
              <p className="text-base-content/70 font-medium">
                {isEditing ? 'Update the details of this piece.' : 'Add a new piece to your collection.'}
              </p>
            </div>

            {!isEditing && (
              <Dialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Scan className="w-4 h-4 mr-2" />
                    Scan Barcode
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Barcode Scanner</DialogTitle>
                  </DialogHeader>
                  <BarcodeScanner
                    onDataExtracted={handleBarcodeData}
                    onClose={() => setShowBarcodeScanner(false)}
                  />
                </DialogContent>
              </Dialog>
            )}

            {isEditing && (
              <QRCodeGenerator
                data={itemUrl}
                title={`UID: ${watchedUID || 'N/A'}`}
                size={150}
              />
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(submitHandler)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <div className="w-full overflow-x-auto pb-2">
                <TabsList className="inline-flex h-auto min-w-max w-full justify-start gap-1 bg-base-200 p-1 rounded-lg">
                  <TabsTrigger value="basic" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    Basic
                  </TabsTrigger>
                  <TabsTrigger value="identification" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    ID
                  </TabsTrigger>
                  <TabsTrigger value="details" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="media" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    Media
                  </TabsTrigger>
                  <TabsTrigger value="variants" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    Variants
                  </TabsTrigger>
                  <TabsTrigger value="parts" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    Parts
                  </TabsTrigger>
                  <TabsTrigger value="location_storage" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    Location
                  </TabsTrigger>
                  <TabsTrigger value="history_context" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                    Notes
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="basic" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      Basic Item Information
                    </CardTitle>
                    <CardDescription>Essential details about your inventory item.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Item Name *</Label>
                          <Input
                            id="name"
                            {...register('name', { required: 'Item Name is required.' })}
                            placeholder="e.g., Victorian Evening Gown"
                            className="bg-base-100"
                          />
                          {errors.name && <p className="text-sm text-error mt-1">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            {...register('description')}
                            placeholder="Detailed description of the item..."
                            rows={3}
                            className="bg-base-100"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label>Categories *</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-base-content/60 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Select one or more categories that best describe this item.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Controller
                            name="categories"
                            control={control}
                            rules={{ required: 'At least one category is required.' }}
                            render={({ field }) => (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" className="w-full justify-start font-normal bg-base-100 flex-grow">
                                    <Package className="mr-2 h-4 w-4" />
                                    {field.value && field.value.length > 0
                                      ? `${field.value.length} selected`
                                      : `Select categories...`}
                                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                  <Command>
                                    <CommandInput placeholder="Search categories..." />
                                    <CommandEmpty>No categories found.</CommandEmpty>
                                    <CommandGroup>
                                      {allCategoryOptions.map((option) => (
                                        <CommandItem
                                          key={option.value}
                                          onSelect={() => {
                                            const currentValue = field.value || [];
                                            const newValue = currentValue.includes(option.value)
                                              ? currentValue.filter(val => val !== option.value)
                                              : [...currentValue, option.value];
                                            field.onChange(newValue);
                                          }}
                                        >
                                          <Checkbox
                                            id={`category-${option.value}`}
                                            checked={field.value?.includes(option.value)}
                                            className="mr-2 h-4 w-4"
                                          />
                                          <Label htmlFor={`category-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                                            {option.icon && <option.icon className="w-4 h-4" />}
                                            {option.label}
                                          </Label>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            )}
                          />
                          {errors.categories && <p className="text-sm text-error mt-1">{errors.categories.message}</p>}
                          {watchedCategories?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {watchedCategories.map(val => (
                                <Badge key={val} variant="secondary">{allCategoryOptions.find(o => o.value === val)?.label || val}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Add other tab contents with proper structure */}
              <TabsContent value="identification" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-primary" />
                      Identification & Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="uid">Unique ID (UID)</Label>
                        <Input
                          id="uid"
                          value={watchedUID || ''}
                          readOnly
                          className="bg-base-300 font-mono text-sm cursor-not-allowed"
                          placeholder={isEditing ? "UID will be preserved" : "Generated automatically"}
                        />
                        <p className="text-xs text-base-content/60">
                          {isEditing ? "UIDs cannot be changed after creation" : "Automatically generated based on category"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="qr_code">QR Code / Barcode</Label>
                        <div className="flex gap-2">
                          <Input
                            id="qr_code"
                            {...register('qr_code')}
                            placeholder="QR code data or barcode..."
                            className="bg-base-100 flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowQRScanner(true)}
                          >
                            <Scan className="w-4 h-4 mr-2" />
                            Scan
                          </Button>
                        </div>
                        <p className="text-xs text-base-content/60">
                          Scan an existing QR code/barcode or enter manually. Leave empty to auto-generate.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Add remaining tab contents */}
              <TabsContent value="details" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle>Physical Properties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <Label>Condition</Label>
                        <Controller
                          name="condition"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="bg-base-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {conditionOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span className={option.color}>{option.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Controller
                          name="status"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="bg-base-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="color">Color</Label>
                        <Input
                          id="color"
                          {...register('color')}
                          placeholder="e.g., Deep red"
                          className="bg-base-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="material">Material</Label>
                        <Input
                          id="material"
                          {...register('material')}
                          placeholder="e.g., Silk, velvet"
                          className="bg-base-100"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="media" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="w-5 h-5 text-primary" />
                      Photos & Media
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 border-2 border-dashed rounded-lg bg-base-100">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhotos.length > 0}
                      >
                        {uploadingPhotos.length > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Upload Photos
                      </Button>

                      {photos.length > 0 && (
                        <div className="grid grid-cols-1 mt-4 sm:grid-cols-2 gap-4">
                          {photos.map((photo, index) => (
                            <div key={index} className="space-y-3 p-2 border border-base-300 rounded-lg">
                              <img
                                src={photo.url}
                                alt={`Photo ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <div className="space-y-2">
                                <Input
                                  placeholder="Photo caption..."
                                  value={photo.caption}
                                  onChange={(e) => handlePhotoUpdate(index, 'caption', e.target.value)}
                                  className="bg-base-100"
                                />
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={photo.is_primary}
                                      onCheckedChange={() => handleSetPrimaryPhoto(index)}
                                    />
                                    <Label className="text-sm">Primary</Label>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePhotoDelete(index)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variants" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle>Item Variants</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="quantity">Quantity in Stock</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        {...register('quantity', { valueAsNumber: true, min: 0 })}
                        placeholder="1"
                        className="bg-base-100"
                      />
                      {errors.quantity && <p className="text-sm text-error mt-1">{errors.quantity.message}</p>}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="parts" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle>Parts & Components</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => appendPart({ name: "", description: "", condition: "good" })}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Part
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="location_storage" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle>Location & Storage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Controller
                          name="location"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}>
                              <SelectTrigger className="bg-base-100">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No location</SelectItem>
                                {locations.map((location) => (
                                  <SelectItem key={location.id} value={location.name}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Container</Label>
                        <Controller
                          name="container_id"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}>
                              <SelectTrigger className="bg-base-100">
                                <SelectValue placeholder="Select container" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No container</SelectItem>
                                {containers.map((container) => (
                                  <SelectItem key={container.id} value={container.id}>
                                    {container.name} - {container.location}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history_context" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle>Historical Context</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="acquisition_date">Date Acquired</Label>
                        <Input
                          id="acquisition_date"
                          type="date"
                          {...register('acquisition_date')}
                          className="bg-base-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Time Period</Label>
                        <Controller
                          name="time_period"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-base-100">
                                <SelectValue placeholder="Select time period" />
                              </SelectTrigger>
                              <SelectContent>
                                {timePeriodOptions.map(period => (
                                  <SelectItem key={period} value={period}>{period}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="pt-6">
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-base-300">
                  <CardHeader>
                    <CardTitle>Additional Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        {...register('notes')}
                        placeholder="Additional notes about this item..."
                        rows={6}
                        className="bg-base-100"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="sticky bottom-0 bg-base-100 border-t border-base-300 p-4 -mx-6 -mb-6 mt-8">
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={onCancel}
                  className="min-h-[44px] w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="min-h-[44px] w-full sm:w-auto bg-primary text-primary-content hover:bg-primary-focus"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {initialData ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    initialData ? 'Update Item' : 'Create Item'
                  )}
                </Button>
              </div>
            </div>
          </form>

          <ItemQRScanner
            isOpen={showQRScanner}
            onClose={() => setShowQRScanner(false)}
            onQRCodeAssigned={handleQRCodeAssigned}
            currentQRCode={watchedQRCode}
          />
        </div>
      </div>
    </div>
  );
}