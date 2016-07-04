"""bbannotator.py
"""
import bbparser


def extract_inheritance_data(classes):
    """
    classes:
        list of bbast.Class instances.

    returns:
        dict of mappings
            from 'qualified-typename'
            to (<list of all bases>, <list of all interfaces>) pairs.
        'all bases' includes all bases, including indirect ones
            (if we didn't include indirect ones, there would be only one).
        
    """


def make_annotator(classes):
    pass




