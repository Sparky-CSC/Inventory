
import React, { useState, useEffect, useCallback } from 'react';
import { Category } from '@/entities/Category';
import { Subcategory } from '@/entities/Subcategory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useForm, Controller } from 'react-hook-form';
import { PlusCircle, Edit, Trash2, Tag, Layers, Package, ChevronsUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Main Page Component
export default function ManageCategories() {
  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
            <Tag className="w-8 h-8 text-primary" />
            Manage Categories
          </h1>
          <p className="text-base lg:text-lg text-primary font-medium">
            Add, edit, or delete item categories and subcategories.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <CategoryManager />
          <SubcategoryManager />
        </div>
      </div>
    </div>
  );
}

// Category Manager Component
function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm();

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await Category.list('name');
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleNew = () => {
    setEditingCategory(null);
    reset({ name: '', description: '', icon_name: 'Package', color: '#6B7280', is_active: true, sort_order: 0 });
    setShowDialog(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    reset(category);
    setShowDialog(true);
  };

  const handleDelete = async (categoryId) => {
    try {
      await Category.delete(categoryId);
      await loadCategories();
    } catch (err) {
      console.error("Failed to delete category", err);
      // You could show an error toast here
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, sort_order: Number(data.sort_order) || 0 };
      if (editingCategory) {
        await Category.update(editingCategory.id, payload);
      } else {
        await Category.create(payload);
      }
      setShowDialog(false);
      await loadCategories();
    } catch (err) {
      console.error("Failed to save category", err);
    }
  };

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5"/> Categories</CardTitle>
          <CardDescription>Main item categories.</CardDescription>
        </div>
        <Button onClick={handleNew}>
          <PlusCircle className="w-4 h-4 mr-2"/> New
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-base-300"/>)
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-base-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                    <Package className="w-4 h-4" style={{ color: cat.color }}/>
                  </div>
                  <div>
                    <p className="font-semibold text-base-content">{cat.name}</p>
                    <p className="text-sm text-base-content/70">{cat.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}>
                    <Edit className="w-4 h-4"/>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-[var(--color-error)]"/>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the "{cat.name}" category. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(cat.id)} className="bg-error hover:bg-error-focus text-error-content">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit' : 'Create'} Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Form fields: name, description, color, etc. */}
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" {...register('name', { required: true })}/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea id="cat-desc" {...register('description')}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="cat-color">Color</Label>
                    <Input id="cat-color" type="color" {...register('color')}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cat-icon">Icon Name</Label>
                    <Input id="cat-icon" {...register('icon_name')} placeholder="e.g., Shirt"/>
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary-focus text-primary-content">Save Category</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Subcategory Manager Component
function SubcategoryManager() {
    const [subcategories, setSubcategories] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingSubcategory, setEditingSubcategory] = useState(null);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [subcatData, catData] = await Promise.all([
                Subcategory.list('name'),
                Category.list('name')
            ]);
            setSubcategories(subcatData);
            setCategories(catData.filter(c => c.is_active));
        } catch (err) {
            console.error("Failed to load subcategory data", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleNew = () => {
        setEditingSubcategory(null);
        reset({ name: '', description: '', category_name: '', is_active: true, sort_order: 0 });
        setShowDialog(true);
    };

    const handleEdit = (subcategory) => {
        setEditingSubcategory(subcategory);
        reset(subcategory);
        setShowDialog(true);
    };

    const handleDelete = async (subcategoryId) => {
        try {
            await Subcategory.delete(subcategoryId);
            await loadData();
        } catch (err) {
            console.error("Failed to delete subcategory", err);
        }
    };

    const onSubmit = async (data) => {
        try {
            const payload = { ...data, sort_order: Number(data.sort_order) || 0 };
            if (editingSubcategory) {
                await Subcategory.update(editingSubcategory.id, payload);
            } else {
                await Subcategory.create(payload);
            }
            setShowDialog(false);
            await loadData();
        } catch (err) {
            console.error("Failed to save subcategory", err);
        }
    };
    
    // Group subcategories by parent
    const groupedSubcategories = subcategories.reduce((acc, sub) => {
        const parent = sub.category_name || 'Uncategorized';
        if (!acc[parent]) {
            acc[parent] = [];
        }
        acc[parent].push(sub);
        return acc;
    }, {});

    return (
        <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><ChevronsUpDown className="w-5 h-5"/> Subcategories</CardTitle>
                    <CardDescription>Specific categories nested under main ones.</CardDescription>
                </div>
                <Button onClick={handleNew}>
                    <PlusCircle className="w-4 h-4 mr-2"/> New
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {isLoading ? (
                        Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full bg-base-300"/>)
                    ) : (
                        Object.entries(groupedSubcategories).map(([parent, subs]) => (
                            <div key={parent}>
                                <h4 className="font-bold mb-2 text-base-content/90 border-b border-base-300 pb-1">{parent}</h4>
                                <div className="space-y-2">
                                    {subs.map(sub => (
                                         <div key={sub.id} className="flex items-center justify-between p-2 bg-base-100 rounded-lg">
                                            <p className="font-medium text-base-content/90">{sub.name}</p>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(sub)}>
                                                    <Edit className="w-4 h-4"/>
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                      <Button variant="ghost" size="icon">
                                                        <Trash2 className="w-4 h-4 text-[var(--color-error)]"/>
                                                      </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                          This will permanently delete the "{sub.name}" subcategory.
                                                        </AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(sub.id)} className="bg-error hover:bg-error-focus text-error-content">
                                                            Delete
                                                        </AlertDialogAction>
                                                      </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                  </AlertDialog>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>

             <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSubcategory ? 'Edit' : 'Create'} Subcategory</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="subcat-parent">Parent Category *</Label>
                        <Controller
                            name="category_name"
                            control={control}
                            rules={{ required: "Parent category is required." }}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select a parent category..."/></SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {errors.category_name && <p className="text-sm text-error mt-1">{errors.category_name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subcat-name">Name</Label>
                      <Input id="subcat-name" {...register('name', { required: true })}/>
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="subcat-desc">Description</Label>
                      <Textarea id="subcat-desc" {...register('description')}/>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button type="submit" className="bg-primary hover:bg-primary-focus text-primary-content">Save Subcategory</Button>
                    </div>
                  </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
